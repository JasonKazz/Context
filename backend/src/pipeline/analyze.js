import {config} from '../config.js';
import {AppError,publicError} from '../errors.js';
import {publicUrl,youtubeUrl} from '../retrieval.js';
import * as exa from '../providers/exa.js';
import * as gemini from '../providers/gemini.js';
import {audioPart} from '../media.js';
import {rank} from './ranking.js';
import {discoveryQueries} from './queries.js';
import {addAlignment} from './alignment.js';
import {emptyAssessment} from './assessment.js';
import {videoCandidates,videoQuery} from './videos.js';
export async function analyze(input,{signal,onUpdate=()=>{},deadline=Date.now()+config.deadlineMs,providers={exa,gemini}}={}) {
 const started=Date.now();const metrics={calls:{exa:0,gemini:0},inputTokens:0,outputTokens:0,estimatedCostUsd:0,exaReportedCostUsd:0,costNotes:new Set(),stages:[]};
 const result={status:'inconclusive',summary:'No source candidate has been established.',context:[],candidates:[],videoCandidates:[],assessment:emptyAssessment(),warnings:[],extraction:null,verification:'Not performed. Indexed text and model interpretations do not prove recording identity.',originality:'Earliest original unknown.'};
 const remaining=()=>deadline-Date.now();
 const snapshot=()=>({...result,metrics:{...metrics,costNotes:[...metrics.costNotes],elapsedMs:Date.now()-started}});
 async function stage(name,limit,work) {
  if(signal?.aborted) throw signal.reason;
  if(remaining()<50) throw new AppError('DEADLINE','The initial processing deadline was reached.');
  const stageSignal=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(Math.max(1,Math.min(limit,remaining())))]);
  const begin=Date.now();onUpdate({stage:name,result:snapshot()});let outcome='ok';
  try{return await work({signal:stageSignal,metrics});}catch(error){outcome=publicError(error).code;throw error;}finally{const timing={stage:name,elapsedMs:Date.now()-begin,outcome};metrics.stages.push(timing);console.log(JSON.stringify({event:'stage',...timing}));}
 }
 try {
  let url=input.url,parts=[],metadata;
  if(url) url=await stage('Checking public link',1200,ctx=>publicUrl(url,ctx.signal));
  if(input.quote) {
   result.extraction={transcript:input.quote,queries:input.quote.split(/(?<=[.!?])\s+/).filter(x=>x.length>12).slice(0,2).map(x=>x.slice(0,180)),description:'User-supplied spoken quote; not independently transcribed.',basis:'user_quote'};
   if(!result.extraction.queries.length) result.extraction.queries=[input.quote.slice(0,180)];
   result.warnings.push('Discovery uses the supplied quote; the submitted recording has not been checked.');
  } else {
   const yt=url?youtubeUrl(url):null;
   if(input.media) {
    const part=await stage('Preparing first 30 seconds of audio',2500,ctx=>audioPart(input.media,ctx.signal));parts=[part];
   } else if(yt) {
    parts=[{fileData:{fileUri:yt},videoMetadata:{startOffset:`${input.startSeconds}s`,endOffset:`${input.startSeconds+30}s`,fps:0.1}}];
    result.warnings.push(`Only the 30-second segment starting at ${input.startSeconds}s was requested. Model-derived speech is a discovery clue.`);
   } else {
    metadata=await stage('Retrieving indexed page text',3000,ctx=>providers.exa.contents(url,ctx));
    parts=[{text:JSON.stringify({title:metadata.title,text:metadata.text})}];
    result.warnings.push('This link was inspected through indexed page text, not its video. Upload the clip or paste a quote if the page text is misleading.');
   }
   try {
    const extraction=await stage('Extracting discovery clues',yt?7000:5000,ctx=>providers.gemini.extract(parts,ctx));
    if(!extraction.queries.length) throw new AppError('NO_CLUES','No usable speech or identifying text was extracted. Upload a short clip or paste its words.',422);
    result.extraction={...extraction,transcript:metadata?'':extraction.transcript,basis:metadata?'indexed_page':input.media?'uploaded_audio':'youtube_segment'};
   } catch(error) {
    if(signal?.aborted) throw error;
    result.warnings.push(publicError(error).message);
    if(!metadata && yt && remaining()>5500) metadata=await stage('Trying indexed text fallback',2000,ctx=>providers.exa.contents(yt,ctx));
    if(!metadata?.title || !metadata.title.replace(/youtube|tiktok|instagram|facebook|[\s\-–|]/gi,'').trim()) throw new AppError('RETRIEVAL_UNAVAILABLE','The video could not be accessed and the public index has no usable title. Try a public link, upload the clip, or paste its spoken quote.',422);
    result.extraction={transcript:'',queries:[metadata.title.slice(0,180)],description:metadata.title,basis:'title_only'};
    result.warnings.push('Fallback uses the page title only. Candidate relevance may be weak; the video was not transcribed.');
   }
  }
  const queries=discoveryQueries(result.extraction);
  result.extraction.queries=queries;
  const results=await stage('Searching public indexes',4000,async ctx=>{
   const settled=await Promise.allSettled(queries.slice(0,2).map(q=>providers.exa.search(q,ctx)));
   for(const item of settled) if(item.status==='rejected') result.warnings.push(publicError(item.reason).message);
   return settled.flatMap(x=>x.status==='fulfilled'?x.value:[]);
  });
  let ranked=rank(results,queries,url);
  result.candidates=ranked.map(c=>addAlignment(c,result.extraction.transcript,result.extraction.basis));
  if(!result.candidates.length)result.summary='No supporting source candidate was found within this search. Try a more distinctive spoken quote or another clip.';
  if(result.candidates.length){result.status='candidate';result.summary='Possible sources found. Text alignment shows which provisional words occur in retrieved text; recording identity remains unchecked.';}
  onUpdate({stage:'Candidates available',result:snapshot()});
  if(remaining()>3500&&(providers.exa.contents||providers.exa.videos)) {
   try {
    await stage('Locating surrounding text and video candidates',Math.min(3000,remaining()-2500),async ctx=>{
     const work=[];
     if(ranked[0]&&providers.exa.contents)work.push((async()=>{
      const page=await providers.exa.contents(ranked[0].url,ctx,60000);
      if(page.text?.length>ranked[0].sourceText.length)ranked[0]={...ranked[0],sourceText:page.text};
      result.candidates=ranked.map(c=>addAlignment(c,result.extraction.transcript,result.extraction.basis));
      onUpdate({stage:'Source passages located',result:snapshot()});
     })());
     if(providers.exa.videos)work.push((async()=>{
      // The candidate title is a discovery clue, not a reference answer or verification.
      const query=videoQuery(result.candidates,result.extraction);
      const found=await providers.exa.videos(query,ctx);
      result.videoCandidates=videoCandidates(found,result.extraction,url);
      onUpdate({stage:'Video candidates available',result:snapshot()});
     })());
     const settled=await Promise.allSettled(work);
     for(const item of settled)if(item.status==='rejected')result.warnings.push(publicError(item.reason).message);
    });
   }catch(error){result.warnings.push(publicError(error).message);}
  } else result.warnings.push('Not enough time remained to retrieve additional context or search for full-video candidates.');
  if(!result.candidates.length){result.summary=result.videoCandidates.length?'Possible video links were found, but no supporting source-text passage was established.':'No supporting source candidate was found. Try a distinctive spoken quote.';return snapshot();}
  if(remaining()>700) {
   try {
    const report=await stage('Writing evidence-based report',Math.min(4500,remaining()-150),ctx=>providers.gemini.summarize(result.extraction,result.candidates,ctx));
    if(report.summary) result.summary=report.summary;result.context=report.context;result.assessment=report.assessment||emptyAssessment();
   } catch(error){result.warnings.push(publicError(error).message);}
  } else result.warnings.push('The deadline left no time for a model-written summary; source evidence is available.');
 } catch(error) {
  const detail=publicError(error);result.warnings.push(detail.message);
  if(!result.candidates.length) {result.status=['UNSAFE_URL','UNAVAILABLE_URL','RETRIEVAL_UNAVAILABLE','MEDIA_PROCESSING','NO_AUDIO','NO_CLUES','EXA_KEY_MISSING','GEMINI_KEY_MISSING'].includes(detail.code)?'input_error':'inconclusive';result.summary=detail.message;}
 }
 return snapshot();
}

import {archiveRecordingLinks} from './recording-links.js';
import {fallbackEvent,contextOptions} from './context.js';
import {config} from '../config.js';
import {AppError,publicError} from '../errors.js';
import {publicUrl,youtubeUrl} from '../retrieval.js';
import * as exa from '../providers/exa.js';
import * as gemini from '../providers/gemini.js';
import {audioPart} from '../media.js';
import {socialUrl,retrieveSocial} from '../providers/social.js';
import {rank} from './ranking.js';
import {discoveryQueries} from './queries.js';
import {addAlignment} from './alignment.js';
import {emptyAssessment} from './assessment.js';
import {videoCandidates,videoQuery,checkedVideo} from './videos.js';
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
  let url=input.url,parts=[],metadata,social;
  if(url) url=await stage('Checking public link',1200,ctx=>publicUrl(url,ctx.signal));
  if(input.quote) {
   result.extraction={transcript:input.quote,queries:input.quote.split(/(?<=[.!?])\s+/).filter(x=>x.length>12).slice(0,2).map(x=>x.slice(0,180)),description:'User-supplied spoken quote; not independently transcribed.',basis:'user_quote'};
   if(!result.extraction.queries.length) result.extraction.queries=[input.quote.slice(0,180)];
   result.warnings.push('Discovery uses the supplied quote; the submitted recording has not been checked.');
  } else {
   const yt=url?youtubeUrl(url):null;
   if(input.media) {
    if(input.media.mimeType.startsWith('video/')){parts=[{inlineData:input.media,videoMetadata:{startOffset:'0s',endOffset:'180s',fps:0.5}}];result.warnings.push('Uploaded video: requested up to 180 seconds with sampled visual frames. Longer recordings receive partial coverage.');}else{const part=await stage('Preparing up to three minutes of audio',2500,ctx=>audioPart(input.media,ctx.signal));parts=[part];result.warnings.push('Uploaded audio: up to 180 seconds processed. No visual evidence is available.');}
   } else if(yt) {
    parts=[{fileData:{fileUri:yt},videoMetadata:{startOffset:`${input.startSeconds}s`,endOffset:`${input.startSeconds+180}s`,fps:0.5}}];
    result.warnings.push(`Requested the complete clip if it ends within 180 seconds of ${input.startSeconds}s; otherwise coverage is partial. Speech and visual observations are model-derived, not frame-by-frame verification.`);
   } else if(socialUrl(url)){
    social=await stage('Retrieving public social video',5000,ctx=>(providers.social?.retrieve||retrieveSocial)(url,ctx));
    parts=[social.part];if(social.audioAvailable===false){parts.push({text:'This retrieved video is reported to have no audio. Return an empty transcript and use visible clues only.'});result.warnings.push('The retrieved video has no reported audio track. Discovery uses visual clues, not transcribed speech.');}result.warnings.push(`${social.platform} video retrieved directly. Up to 180 seconds inspected; sampled frames and transcription remain model-derived.`);
   } else {
    metadata=await stage('Retrieving indexed page text',3000,ctx=>providers.exa.contents(url,ctx));
    parts=[{text:JSON.stringify({title:metadata.title,text:metadata.text})}];
    result.warnings.push('This link was inspected through indexed page text, not its video. Upload the clip or paste a quote if the page text is misleading.');
   }
   try {
    const extraction=await stage('Extracting discovery clues',yt?7000:5000,ctx=>providers.gemini.extract(parts,ctx));
    if(!extraction.queries.length) throw new AppError('NO_CLUES','No usable speech or identifying text was extracted. Upload a short clip or paste its words.',422);
    result.extraction={...extraction,coverage:metadata?'Indexed page only':`Up to 180 seconds from ${yt?(input.startSeconds||0):0}s; model-reported ending: ${extraction.reachedEnd===true?'reached': 'not established'}`,transcript:metadata||social?.audioAvailable===false?'':extraction.transcript,basis:metadata?'indexed_page':social?'social_video':input.media?(input.media.mimeType.startsWith('video/')?'uploaded_video':'uploaded_audio'):'youtube_segment'};
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
   // Start recording discovery alongside page discovery, not after it.
   const work=queries.slice(0,2).map(q=>providers.exa.search(q,ctx));
   if(providers.exa.videos)work.push(providers.exa.videos(videoQuery([],result.extraction),ctx).then(found=>{
    result.videoCandidates=videoCandidates(found,result.extraction,url);
    onUpdate({stage:'Video candidates available',result:snapshot()});
    return found;
   }));
   const settled=await Promise.allSettled(work);
   for(const item of settled) if(item.status==='rejected') result.warnings.push(publicError(item.reason).message);
   return settled.flatMap(x=>x.status==='fulfilled'?x.value:[]);
  });
  let ranked=rank(results,queries,url);
  result.candidates=ranked.map(c=>addAlignment(c,result.extraction.transcript,result.extraction.basis));
  result.videoCandidates=videoCandidates([...results,...result.videoCandidates],result.extraction,url);
  if(!result.candidates.length)result.summary='No supporting source candidate was found within this search. Try a more distinctive spoken quote or another clip.';
  if(result.candidates.length){result.status='candidate';result.summary='Possible sources found. Text alignment shows which provisional words occur in retrieved text; recording identity remains unchecked.';}
  onUpdate({stage:'Candidates available',result:snapshot()});
  if(remaining()>4500&&(providers.exa.contents||providers.exa.videos)) {
   try {
    await stage('Locating surrounding text and video candidates',Math.min(5000,remaining()-4000),async ctx=>{
     const work=[];
     if(providers.exa.contents)for(const candidate of ranked.slice(0,3))work.push((async()=>{
      const page=await providers.exa.contents(candidate.url,ctx,60000);
      const index=ranked.findIndex(c=>c.url===candidate.url);
      if(page.text?.length>candidate.sourceText.length)ranked[index]={...candidate,sourceText:page.text};
      results.push(page);
      result.candidates=ranked.map(c=>addAlignment(c,result.extraction.transcript,result.extraction.basis));
      onUpdate({stage:'Source passages located',result:snapshot()});
     })());
     if(providers.exa.videos&&providers.gemini.eventQuery&&result.candidates.length)work.push((async()=>{
      // The candidate title is a discovery clue, not a reference answer or verification.
      let query='';
      if(providers.gemini.eventQuery){try{const event=await providers.gemini.eventQuery(result.candidates,result.extraction,ctx);if(event){query=event.query;result.eventClue=event;}}catch{}}
      if(!query){const event=fallbackEvent(result.candidates,result.extraction);if(event){query=event.query;result.eventClue=event;result.warnings.push('Event-model extraction was unavailable; searched source wording instead.');}}
      if(!query)return;
      const searches=await Promise.allSettled([providers.exa.videos(query,ctx),...(providers.exa.eventSources?[providers.exa.eventSources(query+' full transcript video',ctx)]:[])]);
      const found=searches.flatMap(s=>s.status==='fulfilled'?s.value:[]);
      for(const s of searches)if(s.status==='rejected')result.warnings.push(publicError(s.reason).message);
      if(providers.exa.publisherVideos){
       const publishers=found.filter(page=>{try{return /\.(gov|edu)$/.test(new URL(page.url).hostname)&&addAlignment({sourceText:page.text||''},result.extraction.transcript,result.extraction.basis).alignment.matchedWords>=6;}catch{return false;}}).sort((a,b)=>Number(new URL(b.url).hostname.includes('archives'))-Number(new URL(a.url).hostname.includes('archives')));
       if(publishers[0])try{found.push(...await providers.exa.publisherVideos(query,new URL(publishers[0].url).hostname,ctx));}catch{result.warnings.push('Publisher recording search did not complete within its budget.');}
      }
      results.push(...found);
      result.videoCandidates=videoCandidates([...found,...result.videoCandidates.map(c=>({...c,text:c.sourceText}))],result.extraction,url,result.eventClue?.query||'');
      onUpdate({stage:'Video candidates available',result:snapshot()});
     })());
     const settled=await Promise.allSettled(work);
     ranked=rank([...ranked.map(c=>({...c,text:c.sourceText})),...results],queries,url);
     result.candidates=ranked.map(c=>addAlignment(c,result.extraction.transcript,result.extraction.basis));
     result.videoCandidates=videoCandidates([...results,...result.videoCandidates],result.extraction,url,result.eventClue?.query||'');
     for(const item of settled)if(item.status==='rejected')result.warnings.push(publicError(item.reason).message);
    });
   }catch(error){result.warnings.push(publicError(error).message);}
  } else result.warnings.push('Not enough time remained to retrieve additional context or search for full-video candidates.');
  // Preserve the archive's own link relation without pretending its text was checked in the video.
  let archive=result.videoCandidates.find(c=>c.recordingPage&&c.timedPassages?.length&&new URL(c.url).hostname==='trump-archive.com');
  if(!archive&&!result.extraction.transcript){const page=results.find(c=>{try{return new URL(c.url).hostname==='trump-archive.com'&&new URL(c.url).pathname.startsWith('/item/');}catch{return false;}});if(page)archive=addAlignment({...page,sourceText:page.text,recordingPage:true,timedPassages:[],verification:'unverified',evidenceKind:'event_search_archive'},'',result.extraction.basis);}
  if(archive){const existing=result.candidates.find(c=>c.url===archive.url);if(existing)existing.recordingPage=true;else result.candidates.push(archive);}
  if(archive&&remaining()>3500){try{await stage('Following transcript recording link',Math.min(2000,remaining()-2500),async ctx=>{
   const links=await archiveRecordingLinks(archive.url,ctx.signal);
   const linked=links.map(url=>({url,title:archive.title,linkedFrom:archive.url,recordingPage:false,evidenceKind:'archive_link',verification:'unverified',fullLengthVerified:false,timedPassages:archive.timedPassages,alignment:{matchedWords:0,clipWords:archive.alignment.clipWords,matches:[],longestRun:0},support:archive.alignment.matches.length?'The matching transcript archive explicitly links this recording. Timestamp cues come from that transcript; audiovisual identity has not been checked.':'An event-search archive links this recording. The submitted clip could not be transcribed, so recording identity remains unconfirmed.'}));
   result.videoCandidates=[...linked,...result.videoCandidates.filter(c=>!links.includes(c.url))].slice(0,6);
  });}catch{result.warnings.push('The transcript was found, but its recording link could not be retrieved within the budget.');}}
  if(result.extraction.visualClues&&providers.gemini.inspectVideo&&remaining()>3000){
   try{await stage('Checking candidate video appearance and speech',Math.min(5500,remaining()-1800),async ctx=>{
    const videos=result.videoCandidates.filter(c=>youtubeUrl(c.url)&&c.eventRelevance>=0&&(c.alignment.matchedWords>=6||c.timedPassages?.length)).slice(0,2);
    await Promise.allSettled(videos.map(async candidate=>{
     try{
      const check=await providers.gemini.inspectVideo(candidate.url,result.extraction,ctx,parts,candidate.timedPassages?.[0]?.startSeconds||0);
      candidate.videoCheck=checkedVideo(check,result.extraction);
     }catch{candidate.videoCheck={status:'inconclusive',observations:'Candidate video could not be checked within the remaining budget.'};}
     onUpdate({stage:'Candidate video check available',result:snapshot()});
    }));
   });}catch(error){result.warnings.push(publicError(error).message);}
  }
  if(!result.candidates.length){result.summary=result.videoCandidates.length?'Possible video links were found, but no supporting source-text passage was established.':'No supporting source candidate was found. Try a distinctive spoken quote.';return snapshot();}
  result.contextEvidence=contextOptions(result.candidates,result.extraction.transcript);
  if(remaining()>700) {
   try {
    const report=await stage('Writing evidence-based report',Math.min(4500,remaining()-150),ctx=>providers.gemini.summarize(result.extraction,result.candidates,ctx));
    if(report.summary) result.summary=report.summary;result.context=report.context;result.assessment=report.assessment||emptyAssessment();
   } catch(error){result.warnings.push(publicError(error).message);}
  } else result.warnings.push('The deadline left no time for a model-written summary; source evidence is available.');
 } catch(error) {
  const detail=publicError(error);result.warnings.push(detail.message);
  if(!result.candidates.length) {result.status=['SOCIAL_UNSUPPORTED','SOCIAL_UNAVAILABLE','SOCIAL_TIMEOUT','SOCIAL_SETUP','UNSAFE_URL','UNAVAILABLE_URL','RETRIEVAL_UNAVAILABLE','MEDIA_PROCESSING','NO_AUDIO','NO_CLUES','EXA_KEY_MISSING','GEMINI_KEY_MISSING'].includes(detail.code)?'input_error':'inconclusive';result.summary=detail.message;}
 }
 if(result.status==='candidate'&&result.extraction?.transcript&&!result.candidates.some(c=>c.alignment?.matches.length)&&!result.videoCandidates.some(c=>c.videoCheck?.status==='supported_sample')){result.status='inconclusive';result.summary='No matching source passage was found for the available transcript or quote. Related search leads below remain unconfirmed.';}
 if(!result.context?.length&&result.contextEvidence?.length)result.context=result.contextEvidence.slice(0,3).map(e=>({...e,explanation:e.position==='background'?'Related article background. The clip transcript was unavailable, so whether this appears in the clip is unknown.':`This source passage appears ${e.position} matched wording and adds words not present in the provisional clip transcript. Its effect on meaning has not been established.`,basis:'verbatim_source'}));
 return snapshot();
}

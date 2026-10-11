import {hasRecordingEvidence} from '../../../shared/contracts.js';
import {youtubeUrl,safeEvidenceUrl} from '../retrieval.js';
import {timedPassages} from './passages.js';
import {addAlignment} from './alignment.js';
export function videoCandidates(results,extraction,inputUrl='',eventQuery='') {
 const seen=new Set();const inputCanonical=inputUrl?(youtubeUrl(inputUrl)||inputUrl):'';
 const canon=raw=>{try{return youtubeUrl(raw)||new URL(raw).origin+new URL(raw).pathname.replace(/\/$/,'');}catch{return '';}};
 const matchedPages=new Map(results.map(item=>[canon(item.url),addAlignment({sourceText:item.text||item.sourceText||''},extraction.transcript,extraction.basis).alignment]));
 const linked=results.flatMap(item=>{
  const links=(item.extras?.links||[]).filter(link=>typeof link==='string').flatMap(link=>{try{return [new URL(link,item.url).href];}catch{return [];}});
  const own=matchedPages.get(canon(item.url))||{};const ownWords=own.matchedWords||0;
  const transcriptUrl=links.find(url=>(matchedPages.get(canon(url))?.matchedWords||0)>=6);
  const words=Math.max(ownWords,transcriptUrl?matchedPages.get(canon(transcriptUrl)).matchedWords:0);
  return links.map(url=>({url,title:`Recording link from ${item.title||'source page'}`,linkedFrom:item.url,transcriptUrl,parentMatchedWords:words,parentLongestRun:Math.max(own.longestRun||0,matchedPages.get(canon(transcriptUrl))?.longestRun||0)}));
 });
 return [...results,...linked].sort((a,b)=>(b.parentMatchedWords||0)-(a.parentMatchedWords||0)||String(b.text||b.sourceText||'').length-String(a.text||a.sourceText||'').length).flatMap(item=>{
  const url=safeEvidenceUrl(item.url);if(!url)return [];
  const u=new URL(url);const host=u.hostname.replace(/^www\./,'');
  const direct=['youtube.com','youtu.be','vimeo.com','c-span.org'].includes(host);
  const timed=timedPassages(String(item.text||item.sourceText||'').slice(0,90000),extraction.transcript||'');
  if(!direct&&!timed.length)return [];
  if(host==='c-span.org'&&!/^\/(program|clip|event)\//.test(u.pathname))return [];
  const canonical=youtubeUrl(url)||url;if(canonical===inputCanonical||seen.has(canonical))return [];seen.add(canonical);
  const sourceText=String(item.text||item.sourceText||'').slice(0,90000);const title=String(item.title||'Video search result').slice(0,300);
  return [addAlignment({url:canonical,title,excerpt:sourceText.slice(0,1200),sourceText,linkedFrom:item.linkedFrom,transcriptUrl:item.transcriptUrl,parentMatchedWords:item.parentMatchedWords||0,parentLongestRun:item.parentLongestRun||0,timedPassages:timed,recordingPage:!direct,eventRelevance:eventScore(title,eventQuery),evidenceKind:item.parentMatchedWords>=6?'matched_transcript_link':direct?'video_indexed_text':'timestamped_transcript',support:'Returned by a search for a longer recording. Duration, completeness and recording identity have not been checked.',verification:'unverified',fullLengthVerified:false},extraction.transcript,extraction.basis)];
 }).sort((a,b)=>Number(hasRecordingEvidence(b))-Number(hasRecordingEvidence(a))||Math.max(b.alignment.matchedWords,b.parentMatchedWords||0)-Math.max(a.alignment.matchedWords,a.parentMatchedWords||0)||b.eventRelevance-a.eventRelevance).slice(0,5);
}

export function videoQuery(candidates,extraction){
 return `${extraction.queries[0]||''} ${extraction.basis==='user_quote'?'':extraction.description||''} full speech interview recording`.slice(0,500);
}

export function checkedVideo(check,extraction){
 const aligned=addAlignment({sourceText:check.transcript||''},extraction.transcript,extraction.basis);
 return {...check,transcript:undefined,matchedWords:aligned.alignment.matchedWords,clipWords:aligned.alignment.clipWords,status:check.visual==='consistent'&&aligned.alignment.longestRun>=12?'supported_sample':check.visual==='different'?'different_sample':aligned.alignment.longestRun>=12?'speech_sample_match':'inconclusive'};
}

function eventScore(title,query){
 const ignored=new Set(['donald','trump','president','video','full','event','press','remarks']);
 const years=query.match(/\b20\d{2}\b/g)||[];
 const titleYears=title.match(/\b20\d{2}\b/g)||[];
 if(years.length&&titleYears.length&&!years.some(y=>titleYears.includes(y)))return -100;
 const terms=[...new Set(query.toLowerCase().match(/[a-z0-9]{4,}/g)||[])].filter(w=>!ignored.has(w));
 return terms.filter(w=>title.toLowerCase().includes(w)).length;
}

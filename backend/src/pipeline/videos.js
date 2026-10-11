import {youtubeUrl,safeEvidenceUrl} from '../retrieval.js';
import {addAlignment} from './alignment.js';
export function videoCandidates(results,extraction,inputUrl='',eventQuery='') {
 const seen=new Set();const inputCanonical=inputUrl?(youtubeUrl(inputUrl)||inputUrl):'';
 return results.flatMap(item=>{
  const url=safeEvidenceUrl(item.url);if(!url)return [];
  const u=new URL(url);const host=u.hostname.replace(/^www\./,'');
  if(!['youtube.com','youtu.be','vimeo.com','c-span.org'].includes(host))return [];
  if(host==='c-span.org'&&!/^\/(program|clip|event)\//.test(u.pathname))return [];
  const canonical=youtubeUrl(url)||url;if(canonical===inputCanonical||seen.has(canonical))return [];seen.add(canonical);
  const sourceText=String(item.text||'').slice(0,16000);const title=String(item.title||'Video search result').slice(0,300);
  return [addAlignment({url:canonical,title,excerpt:sourceText.slice(0,1200),sourceText,evidenceKind:'video_indexed_text',support:'Returned by a search for a longer recording. Duration, completeness and recording identity have not been checked.',verification:'unverified',fullLengthVerified:false},extraction.transcript,extraction.basis)];
 }).sort((a,b)=>b.alignment.matchedWords-a.alignment.matchedWords||eventScore(b.title,eventQuery)-eventScore(a.title,eventQuery)).slice(0,5);
}

export function videoQuery(candidates,extraction){
 return `${extraction.queries[0]||''} ${extraction.basis==='user_quote'?'':extraction.description||''} full speech interview recording`.slice(0,500);
}

export function checkedVideo(check,extraction){
 const aligned=addAlignment({sourceText:check.transcript||''},extraction.transcript,extraction.basis);
 return {...check,transcript:undefined,matchedWords:aligned.alignment.matchedWords,clipWords:aligned.alignment.clipWords,status:check.visual==='consistent'&&aligned.alignment.longestRun>=12?'supported_sample':check.visual==='different'?'different_sample':'inconclusive'};
}

function eventScore(title,query){
 const ignored=new Set(['donald','trump','president','video','full','event','press','remarks']);
 const terms=[...new Set(query.toLowerCase().match(/[a-z0-9]{4,}/g)||[])].filter(w=>!ignored.has(w));
 return terms.filter(w=>title.toLowerCase().includes(w)).length;
}

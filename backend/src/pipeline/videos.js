import {youtubeUrl,safeEvidenceUrl} from '../retrieval.js';
import {addAlignment} from './alignment.js';
export function videoCandidates(results,extraction,inputUrl='') {
 const seen=new Set();const inputCanonical=inputUrl?(youtubeUrl(inputUrl)||inputUrl):'';
 return results.flatMap(item=>{
  const url=safeEvidenceUrl(item.url);if(!url)return [];
  const u=new URL(url);const host=u.hostname.replace(/^www\./,'');
  if(!['youtube.com','youtu.be','vimeo.com','c-span.org'].includes(host))return [];
  const canonical=youtubeUrl(url)||url;if(canonical===inputCanonical||seen.has(canonical))return [];seen.add(canonical);
  const sourceText=String(item.text||'').slice(0,16000);const title=String(item.title||'Video search result').slice(0,300);
  return [addAlignment({url:canonical,title,excerpt:sourceText.slice(0,1200),sourceText,evidenceKind:'video_indexed_text',support:'Returned by a search for a longer recording. Duration, completeness and recording identity have not been checked.',verification:'unverified',fullLengthVerified:false},extraction.transcript,extraction.basis)];
 }).sort((a,b)=>b.alignment.matchedWords-a.alignment.matchedWords).slice(0,3);
}

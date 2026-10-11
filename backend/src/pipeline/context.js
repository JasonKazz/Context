import {tokens} from './alignment.js';
// Verbatim source sentences outside the matched wording, never invented omissions.
export function contextOptions(candidates,transcript=''){
 const clip=new Set(tokens(transcript).map(t=>t.word));const seen=new Set();const out=[];
 candidates.forEach((c,index)=>{
  const passage=c.alignment?.continuous||(!transcript&&c.excerpt?{text:c.excerpt,ranges:[]}:null);if(!passage)return;
  const sentences=[...passage.text.matchAll(/[^.!?\n]+[.!?]+(?:[”"’']|$)?/g)];
  for(const m of sentences){const quote=m[0].trim();const words=tokens(quote);if(words.length<12||quote.length>700)continue;
   const novel=words.filter(w=>!clip.has(w.word)).length;
   if(novel<6||novel/words.length<.3)continue;
   const start=m.index,end=start+m[0].length;const overlap=passage.ranges.reduce((n,a)=>n+Math.max(0,Math.min(end,a.end)-Math.max(start,a.start)),0);
   if(overlap>quote.length*.25)continue;
   const key=words.map(t=>t.word).join(' ');if(seen.has(key))continue;seen.add(key);
   const first=Math.min(...passage.ranges.map(a=>a.start)),last=Math.max(...passage.ranges.map(a=>a.end));
   out.push({id:`context-${index+1}-${out.length+1}`,sourceId:index+1,quote,position:!transcript?'background':end<=first?'before':start>=last?'after':'between',distance:(start>=first&&end<=last?0:Math.min(Math.abs(end-first),Math.abs(start-last))),recordingTranscript:!!c.recordingPage,sourceUrl:c.url});
  }
 });
 return out.sort((a,b)=>Number(b.recordingTranscript)-Number(a.recordingTranscript)||a.distance-b.distance).slice(0,12).map(({distance,...item})=>item);
}
export function fallbackEvent(candidates,extraction){
 for(const c of candidates){if(extraction.transcript&&!c.alignment?.matches.length)continue;
  const passages=[c.excerpt,c.alignment?.continuous?.text,...(c.alignment?.passages||[]).map(p=>p.text)].filter(Boolean);
  for(const p of passages){for(const match of p.matchAll(/[^.!?\n]{0,300}(?:rally|commencement|interview|address|conference|speech)[^.!?\n]{0,300}/gi)){
   const quote=match[0].trim();if(!/\b(?:20\d{2}|19\d{2})\b/.test(quote))continue;
   return {query:quote.slice(0,480)+' full speech video transcript',supportingQuote:quote,method:'source_sentence'};
  }}
 }
 const source=candidates.find(c=>c.alignment?.matches.length)||(!extraction.transcript&&candidates[0]);if(!source)return null;
 return {query:`${source.title} ${extraction.queries?.[0]||''} full speech transcript video`.slice(0,550),supportingQuote:source.title,method:'source_title_fallback'};
}

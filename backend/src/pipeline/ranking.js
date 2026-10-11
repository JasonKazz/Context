import {safeEvidenceUrl,youtubeUrl} from '../retrieval.js';
const words=text=>String(text).toLowerCase().match(/[a-z0-9]{4,}/g)||[];
export function rank(results,queries,inputUrl='') {
 const terms=new Set(words(queries.join(' '))); const seen=new Set(); const ranked=[];
 for(const item of results) {
  const url=safeEvidenceUrl(item.url); if(!url) continue;
  const canonical=u=>{try {return youtubeUrl(u)||new URL(u).origin+new URL(u).pathname.replace(/\/$/,'');}catch{return u;}};
  const key=canonical(url); if(seen.has(key)|| (inputUrl && key===canonical(inputUrl))) continue; seen.add(key);
  const text=String(item.text||'').slice(0,7000); const highlights=Array.isArray(item.highlights)?item.highlights.filter(x=>typeof x==='string').join('\n'):'';
  const evidence=text||highlights; if(evidence.trim().length<30) continue;
  const found=[...terms].filter(t=>words(`${item.title} ${evidence}`).includes(t));
  const exact=queries.some(q=>q.replaceAll('"','').trim().length>15&&evidence.toLowerCase().includes(q.replaceAll('"','').trim().toLowerCase()));
  let start=0;
  if(text) {const best=[...terms].map(t=>text.toLowerCase().indexOf(t)).filter(i=>i>=0).sort((a,b)=>a-b)[0];start=Math.max(0,(best||0)-200);}
  const excerpt=evidence.slice(start,start+1800);
  ranked.push({title:String(item.title||'Untitled result').slice(0,300),url,excerpt,evidenceKind:text?'indexed_text':'search_highlight',support:exact?'A searched phrase occurs in the indexed text.':found.length?`Shared search terms: ${found.slice(0,8).join(', ')}.`:'Returned by public search; wording overlap is weak.',verification:'unverified',score:found.length+(exact?30:0)});
 }
 return ranked.sort((a,b)=>b.score-a.score).slice(0,3).map(({score,...c})=>c);
}

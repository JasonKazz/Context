import {safeEvidenceUrl,youtubeUrl} from '../retrieval.js';
const stop=new Set('about after again also because before being could every first from giving have having here into just like made more most other over said same should some speech than that their them then there these they this those through very were what when where which while will with would your'.split(' '));
const words=text=>(String(text).toLowerCase().match(/[a-z0-9]{4,}/g)||[]).filter(w=>!stop.has(w));
const normalized=text=>String(text).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function rank(results,queries,inputUrl='') {
 const terms=new Set(words(queries.join(' ')));const seen=new Set();const ranked=[];
 for(const item of results){
  const url=safeEvidenceUrl(item.url);if(!url)continue;
  const canonical=u=>{try{return youtubeUrl(u)||new URL(u).origin+new URL(u).pathname.replace(/\/$/,'');}catch{return u;}};
  const key=canonical(url);if(seen.has(key)||(inputUrl&&key===canonical(inputUrl)))continue;seen.add(key);
  const text=String(item.text||'').slice(0,15000);
  const highlights=Array.isArray(item.highlights)?item.highlights.filter(x=>typeof x==='string').join('\n'):'';
  const evidence=text||highlights;if(evidence.trim().length<30)continue;
  const found=[...terms].filter(t=>words(evidence).includes(t));
  const exact=queries.some(q=>normalized(q).length>20&&normalized(evidence).includes(normalized(q)));
  // Weak shared words are not enough to present a result as a source candidate.
  if(!exact&&(found.length<3||found.length/Math.max(1,terms.size)<.25))continue;
  let start=0,best=-1;
  for(let i=0;i<evidence.length;i+=250){const window=evidence.slice(i,i+1000);const tokens=new Set(words(window));const score=[...terms].filter(t=>tokens.has(t)).length;if(score>best){best=score;start=Math.max(0,i-200);}}
  const excerpt=evidence.slice(start,start+1800);
  ranked.push({title:String(item.title||new URL(url).hostname).slice(0,300),url,excerpt,evidenceKind:text?'indexed_text':'search_highlight',support:exact?'A searched phrase occurs in the indexed text.':`Shared search terms: ${found.slice(0,8).join(', ')}.`,verification:'unverified',score:found.length+(exact?30:0)});
 }
 return ranked.sort((a,b)=>b.score-a.score).slice(0,3).map(({score,...candidate})=>candidate);
}

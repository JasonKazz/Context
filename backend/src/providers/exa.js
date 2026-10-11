import { config } from '../config.js';
import { AppError } from '../errors.js';
import { providerJson } from './http.js';
async function call(endpoint,body,ctx) {
 if(!config.exaApiKey) throw new AppError('EXA_KEY_MISSING','Add EXA_API_KEY to the local .env and restart the server.',503);
 ctx.metrics.calls.exa++;
 const result=await providerJson(`https://api.exa.ai/${endpoint}`,{body,headers:{'x-api-key':config.exaApiKey},signal:ctx.signal,provider:'Exa'});
 if(Number.isFinite(result.costDollars?.total)) ctx.metrics.exaReportedCostUsd+=result.costDollars.total;
 else {ctx.metrics.estimatedCostUsd += endpoint==='search' ? .007 : .001;ctx.metrics.costNotes.add('Exa fallback estimate: fast search $0.007; content $0.001/page.');}
 return result;
}
export async function contents(url,ctx,maxCharacters=10000) {
 const result=await call('contents',{ids:[url],text:{maxCharacters},extras:{links:20},livecrawl:'fallback',livecrawlTimeout:1500},ctx);
 const item=result.results?.[0];
 if(!item || !(item.text||item.title)) throw new AppError('RETRIEVAL_UNAVAILABLE','This page is unavailable to the public index. Upload a short clip or paste its spoken quote.',422);
 return {title:String(item.title||'').slice(0,400),text:String(item.text||'').slice(0,maxCharacters),url:item.url||url,extras:item.extras};
}
export async function search(query,ctx) {
 const result=await call('search',{query,type:'fast',numResults:5,contents:{text:{maxCharacters:15000},highlights:{numSentences:3}}},ctx);
 return result.results || [];
}

export async function videos(query,ctx) {
 const searches=await Promise.allSettled([
  call('search',{query:query.slice(0,600),type:'fast',numResults:8,includeDomains:['youtube.com'],contents:{text:{maxCharacters:16000}}},ctx),
  call('search',{query:query.slice(0,600),type:'fast',numResults:3,includeDomains:['c-span.org','vimeo.com'],contents:{text:{maxCharacters:16000}}},ctx)
 ]);
 if(searches.every(s=>s.status==='rejected'))throw searches[0].reason;
 return searches.flatMap(s=>s.status==='fulfilled'?s.value.results||[]:[]);
}

// Event-specific open-web retrieval can discover transcript archives outside video hosts.
export async function eventSources(query,ctx){
 const result=await call('search',{query:query.slice(0,600),type:'auto',numResults:5,contents:{text:{maxCharacters:90000},extras:{links:20}}},ctx);
 return result.results||[];
}

// One bounded search on a publisher already discovered through matching source text.
export async function publisherVideos(query,domain,ctx){
 const result=await call('search',{query:query.slice(0,550),type:'auto',numResults:5,includeDomains:[domain],contents:{text:{maxCharacters:30000},extras:{links:20}}},ctx);
 return result.results||[];
}

export async function recordings(query,ctx){
 const result=await call('search',{query,type:'auto',numResults:8,contents:{text:{maxCharacters:5000},extras:{links:20}}},ctx);
 return result.results||[];
}

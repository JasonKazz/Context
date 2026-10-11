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
 const result=await call('contents',{ids:[url],text:{maxCharacters},livecrawl:'fallback',livecrawlTimeout:1500},ctx);
 const item=result.results?.[0];
 if(!item || !(item.text||item.title)) throw new AppError('RETRIEVAL_UNAVAILABLE','This page is unavailable to the public index. Upload a short clip or paste its spoken quote.',422);
 return {title:String(item.title||'').slice(0,400),text:String(item.text||'').slice(0,maxCharacters),url:item.url||url};
}
export async function search(query,ctx) {
 const result=await call('search',{query,type:'fast',numResults:5,contents:{text:{maxCharacters:15000},highlights:{numSentences:3}}},ctx);
 return result.results || [];
}

export async function videos(query,ctx) {
 const result=await call('search',{query:`${query.slice(0,300)} full speech full interview recording`,type:'fast',numResults:4,includeDomains:['youtube.com','vimeo.com','c-span.org'],contents:{text:{maxCharacters:16000}}},ctx);
 return result.results||[];
}

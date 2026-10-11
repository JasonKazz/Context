import { AppError } from '../errors.js';
export async function providerJson(url, {body,headers,signal,provider}) {
 let response;
 try { response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal,redirect:'error'}); }
 catch(error) { if(signal.aborted) throw signal.reason; throw new AppError('PROVIDER_NETWORK',`${provider} could not be reached.`,502); }
 if(!response.ok) {
  await response.body?.cancel();
  const message=response.status===429 ? `${provider} quota or rate limit reached. Check the provider dashboard or retry later.` : [401,403].includes(response.status) ? `${provider} rejected the API key or account permissions.` : `${provider} could not process this input (HTTP ${response.status}).`;
  throw new AppError(`PROVIDER_${response.status}`,message,502);
 }
 const reader=response.body.getReader(); let length=0; const chunks=[];
 while(true) { const {done,value}=await reader.read(); if(done) break; length+=value.byteLength; if(length>2000000){await reader.cancel();throw new AppError('PROVIDER_RESPONSE_LIMIT',`${provider} response was too large.`,502);} chunks.push(Buffer.from(value)); }
 try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new AppError('PROVIDER_FORMAT',`${provider} returned an unreadable response.`,502);}
}

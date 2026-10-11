import https from 'node:https';
import {lookup} from 'node:dns';
import {isPublicAddress,publicUrl,youtubeUrl} from '../retrieval.js';

// Only follow explicitly supported transcript archives, with no redirects or media downloads.
export function recordingLinks(html){
 const links=new Set();
 for(const script of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const walk=value=>{if(!value||typeof value!=='object')return;
   if(value['@type']==='VideoObject'&&typeof value.embedUrl==='string'){
    const u=new URL(value.embedUrl);const id=u.pathname.match(/^\/video\/(\d+)$/)?.[1];
    if(u.protocol==='https:'&&u.hostname==='player.vimeo.com'&&id)links.add(`https://vimeo.com/${id}`);
   }
   for(const child of Object.values(value))if(typeof child==='object')walk(child);
  };walk(JSON.parse(script[1]));}catch{}
 }
 return [...links].slice(0,3);
}
export async function archiveRecordingLinks(url,signal){
 const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='trump-archive.com'||!u.pathname.startsWith('/item/')||u.port||u.username||u.password)return [];
 const html=await publicHtml(u,signal);
 return recordingLinks(html);
}
async function publicHtml(u,signal){
 await publicUrl(u.href,signal);
 if(u.protocol!=='https:')throw new Error('HTTPS required');
 return await new Promise((resolve,reject)=>{
  const req=https.get(u,{signal,lookup:(host,options,cb)=>lookup(host,options,(err,address,family)=>{
   const addresses=Array.isArray(address)?address:[{address,family}];
   if(err||addresses.some(a=>!isPublicAddress(a.address)))return cb(err||new Error('Blocked destination'));
   cb(null,address,family);
  })},res=>{if(res.statusCode!==200){res.destroy();reject(new Error('Archive unavailable'));return;}
   let size=0;const chunks=[];res.on('data',chunk=>{size+=chunk.length;if(size>600000){res.destroy(new Error('Archive too large'));return;}chunks.push(chunk);});
   res.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));res.on('error',reject);
  });req.on('error',reject);
 });
}

export function publisherMetadata(html){
 const videos=[];
 const canonical=raw=>{try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password)return null;const yt=youtubeUrl(raw);if(yt)return yt;const v=u.hostname==='player.vimeo.com'&&u.pathname.match(/^\/video\/(\d+)$/);return v?`https://vimeo.com/${v[1]}`:null;}catch{return null;}};
 for(const script of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const walk=value=>{if(!value||typeof value!=='object')return;
   if([value['@type']].flat().includes('VideoObject'))videos.push({title:String(value.name||'').slice(0,300),duration:String(value.duration||'').slice(0,50),embedUrl:canonical(value.embedUrl)});
   for(const child of Object.values(value))if(typeof child==='object')walk(child);
  };walk(JSON.parse(script[1]));}catch{}
 }
 for(const iframe of html.matchAll(/<iframe[^>]*\bsrc=["']([^"']+)["']/gi)){const embedUrl=canonical(iframe[1]);if(embedUrl)videos.push({embedUrl});}
 return videos.slice(0,5);
}
export async function publisherRecordingMetadata(url,signal){
 return publisherMetadata(await publicHtml(new URL(url),signal));
}

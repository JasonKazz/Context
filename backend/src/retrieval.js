import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AppError } from './errors.js';
export function isPublicAddress(address) {
 if (isIP(address) === 6) return /^[23][0-9a-f]{3}:/i.test(address) && !address.toLowerCase().startsWith('2001:db8:');
 if (isIP(address) !== 4) return false;
 const [a,b] = address.split('.').map(Number);
 return !(a===0 || a===10 || a===127 || a>=224 || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&b===168) || (a===100&&b>=64&&b<=127) || (a===198&&(b===18||b===19)) || (a===192&&b===0));
}
export async function publicUrl(raw, signal) {
 const url = new URL(raw);
 if (!['http:','https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port))) throw new AppError('UNSAFE_URL','Use a public web link on a standard HTTP(S) port.');
 const host=url.hostname.toLowerCase();
 if (isIP(host.replace(/^\[|\]$/g,'')) || host==='localhost' || !host.includes('.') || /\.(local|localhost|internal|test|invalid)$/.test(host)) throw new AppError('UNSAFE_URL','Local and private network addresses are not supported.');
 const addresses = await Promise.race([
  lookup(host,{all:true}).catch(()=>{throw new AppError('UNAVAILABLE_URL','The hostname could not be resolved. Check the link.');}),
  new Promise((_,reject)=>{ if(signal.aborted) return reject(signal.reason); signal.addEventListener('abort',()=>reject(signal.reason),{once:true}); }),
 ]);
 if (!addresses.length || addresses.some(x=>!isPublicAddress(x.address))) throw new AppError('UNSAFE_URL','Local and private network destinations are not supported.');
 url.hash=''; return url.href;
}
export function youtubeUrl(raw) {
 const url=new URL(raw); let id;
 if (url.hostname==='youtu.be') id=url.pathname.slice(1);
 else if (['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname)) id=url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
 return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
}
export function safeEvidenceUrl(raw) {
 try {const u=new URL(raw); if(!['http:','https:'].includes(u.protocol)||u.username||u.password) return null; return u.href;} catch{return null;}
}

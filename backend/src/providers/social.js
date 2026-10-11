import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {config,root} from '../config.js';
import {AppError} from '../errors.js';

export function socialUrl(raw){
 let u;try{u=new URL(raw);}catch{return null;}
 if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
 const host=u.hostname.toLowerCase().replace(/^www\./,'');let platform;
 if(host==='instagram.com'&&/^\/(?:reel|reels|p|tv)\/[\w-]+\/?$/.test(u.pathname))platform='Instagram';
 if(['tiktok.com','m.tiktok.com'].includes(host)&&/^\/@[\w.-]+\/video\/\d+\/?$/.test(u.pathname))platform='TikTok';
 if(['vm.tiktok.com','vt.tiktok.com'].includes(host)&&/^\/[\w-]+\/?$/.test(u.pathname))platform='TikTok';
 if(host==='tiktok.com'&&/^\/t\/[\w-]+\/?$/.test(u.pathname))platform='TikTok';
 if(['x.com','twitter.com','mobile.twitter.com'].includes(host)&&/^\/(?:[\w]+\/status|i\/(?:web\/)?status)\/\d+(?:\/video\/\d+)?\/?$/.test(u.pathname))platform='X';
 if(!platform)return null;
 u.search='';u.hash='';return {url:u.href,platform};
}

export async function retrieveSocial(raw,ctx,{python=config.socialPython,script=resolve(root,'backend/scripts/social_video.py')}={}){
 const post=socialUrl(raw);if(!post)throw new AppError('SOCIAL_UNSUPPORTED','Use a public Instagram Reel/post, TikTok video, or X status link. Otherwise upload the clip.',422);
 ctx.signal?.throwIfAborted();
 const directory=await mkdtemp(join(tmpdir(),'quantro-social-'));const output=join(directory,'clip.mp4');
 try{
  const result=await new Promise((resolvePromise,reject)=>{
   let stdout='',settled=false;const finish=(error,value)=>{if(settled)return;settled=true;error?reject(error):resolvePromise(value);};
   const child=spawn(python,['-I',script],{cwd:directory,env:{PATH:process.env.PATH||'',PYTHONNOUSERSITE:'1'},stdio:['pipe','pipe','ignore'],signal:ctx.signal,killSignal:'SIGKILL'});
   let startError;
   child.once('error',error=>{startError=error;});
   child.stdout.on('data',chunk=>{stdout+=chunk.toString();if(stdout.length>4096)child.kill('SIGKILL');});
   child.stdin.on('error',()=>{});
   child.once('close',()=>{
    if(ctx.signal?.aborted)return finish(new AppError('SOCIAL_TIMEOUT',`${post.platform} could not be retrieved within the time budget. Upload the clip or paste its spoken words.`,422));
    if(startError)return finish(new AppError('SOCIAL_SETUP','Social-video retrieval is unavailable. Install the optional local retrieval dependency or upload the clip.',503));
    try{finish(null,JSON.parse(stdout));}catch{finish(new AppError('SOCIAL_UNAVAILABLE',`${post.platform} did not return a usable public video. Upload the clip instead.`,422));}
   });
   child.stdin.end(JSON.stringify({url:post.url,output}));
  });
  if(!result.ok){const explanation={MULTIPLE_VIDEOS:'This post contains a collection rather than one video.',TOO_LONG:'The video exceeds the three-minute retrieval limit.',TOO_LARGE:'The video exceeds the 8 MB retrieval limit.',NO_SMALL_MP4:'No small, directly downloadable MP4 was available.'}[result.code]||'The post is unavailable, blocked, private, or requires login.';throw new AppError('SOCIAL_UNAVAILABLE',`${post.platform}: ${explanation} Upload a short clip or paste its spoken words.`,422);}
  const bytes=await readFile(output);if(bytes.length>8*1024*1024)throw new AppError('SOCIAL_UNAVAILABLE','The video exceeds 8 MB. Upload a smaller clip.',422);
  return {part:{inlineData:{mimeType:'video/mp4',data:bytes.toString('base64')},videoMetadata:{startOffset:'0s',endOffset:'180s',fps:0.5}},platform:post.platform,duration:result.duration,audioAvailable:result.audioAvailable};
 }finally{await rm(directory,{recursive:true,force:true});}
}

import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {config} from './config.js';
import {AppError} from './errors.js';
export async function audioPart(media,signal) {
 const directory=await mkdtemp(join(tmpdir(),'quantro-'));
 try {
  const input=join(directory,'input');const output=join(directory,'audio.wav');
  await writeFile(input,Buffer.from(media.data,'base64'),{mode:0o600});
  await new Promise((resolve,reject)=>{
   const child=spawn(config.ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-threads','1','-protocol_whitelist','file,pipe','-i',input,'-t','30','-vn','-ac','1','-ar','16000','-fs','2000000',output],{stdio:'ignore',signal,killSignal:'SIGKILL'});
   child.once('error',()=>reject(new AppError('MEDIA_PROCESSING','Cannot decode this clip. Check ffmpeg is installed or try MP4/MP3.',422)));
   child.once('exit',code=>code===0?resolve():reject(new AppError('MEDIA_PROCESSING','This file could not be decoded within the time budget. Try a shorter MP4/MP3.',422)));
  });
  const audio=await readFile(output);
  if(audio.length<100) throw new AppError('NO_AUDIO','No readable audio was found in this clip.',422);
  return {inlineData:{mimeType:'audio/wav',data:audio.toString('base64')}};
 } finally { await rm(directory,{recursive:true,force:true}); }
}

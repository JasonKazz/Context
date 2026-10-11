import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {socialUrl,retrieveSocial} from '../backend/src/providers/social.js';

test('social URLs are exact platform post routes, with tracking removed',()=>{
 for(const [url,platform] of [['https://www.instagram.com/reel/AbC123/?igsh=tracker','Instagram'],['https://www.tiktok.com/t/ZPLhVCWeN/','TikTok'],['https://vm.tiktok.com/Z123/','TikTok'],['https://www.tiktok.com/@sample/video/123456','TikTok'],['https://x.com/example/status/123456?s=20','X']]){const result=socialUrl(url);assert.equal(result.platform,platform);assert.equal(new URL(result.url).search,'');}
 for(const url of ['https://tiktok.com.evil.test/t/a','https://user:pass@x.com/a/status/12','https://x.com:444/a/status/12','file:///etc/passwd','https://instagram.com/profile','https://x.com/example','https://127.0.0.1/a/status/123'])assert.equal(socialUrl(url),null);
});
let python;try{execFileSync('python3',['--version'],{stdio:'ignore'});python='python3';}catch{}
test('social helper blocks private connections and rejects oversized/non-progressive media',{skip:!python},()=>{
 execFileSync(python,['tests/social_guard.py'],{cwd:resolve('.'),stdio:'pipe'});
});
test('social process cancellation kills work, sanitizes errors and removes temporary media',{skip:!python},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'quantro-social-fixture-'));const script=join(directory,'slow.py');const marker=join(directory,'marker');
 await writeFile(script,`import json,sys,time,os\nr=json.load(sys.stdin)\nopen(${JSON.stringify(marker)},'w').write(r['output'])\nopen(r['output'],'wb').write(b'partial')\ntime.sleep(30)\n`);
 try{
  const started=Date.now();await assert.rejects(retrieveSocial('https://www.tiktok.com/t/example/',{signal:AbortSignal.timeout(700)},{python,script}),e=>e.code==='SOCIAL_TIMEOUT'&&!e.message.includes('http'));
  assert.ok(Date.now()-started<2500);
  const {readFile}=await import('node:fs/promises');const output=await readFile(marker,'utf8');await assert.rejects(access(output));
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('social process receives no provider secrets and never returns upstream errors',{skip:!python},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'quantro-social-fixture-'));const script=join(directory,'error.py');
 await writeFile(script,`import os,json\nassert 'GEMINI_API_KEY' not in os.environ and 'EXA_API_KEY' not in os.environ\nprint(json.dumps({'ok':False,'code':'PRIVATE_SIGNED_URL_AND_TOKEN'}))\n`);
 try{await assert.rejects(retrieveSocial('https://x.com/example/status/123',{signal:AbortSignal.timeout(2000)},{python,script}),e=>e.code==='SOCIAL_UNAVAILABLE'&&!e.message.includes('TOKEN'));}finally{await rm(directory,{recursive:true,force:true});}
});

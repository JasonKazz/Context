import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateInput} from '../shared/contracts.js';
import {isPublicAddress,youtubeUrl,publicUrl} from '../backend/src/retrieval.js';
import {rank} from '../backend/src/pipeline/ranking.js';
import {analyze} from '../backend/src/pipeline/analyze.js';
import {JobStore} from '../backend/src/jobs.js';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('input rejects credential URLs, bad protocols and oversized quotes',()=>{
 for(const url of ['file:///etc/passwd','https://user:pass@example.com'])assert.throws(()=>validateInput({url}));
 assert.throws(()=>validateInput({quote:'x'.repeat(4001)}));assert.throws(()=>validateInput({}));assert.equal(validateInput({quote:'Some actual spoken words.'}).quote,'Some actual spoken words.');
});
test('private destinations and IP variants are rejected',async()=>{
 for(const ip of ['127.0.0.1','10.1.1.1','169.254.169.254','172.16.1.1','192.168.1.1','100.64.1.1','::1','::ffff:127.0.0.1'])assert.equal(isPublicAddress(ip),false);
 for(const url of ['http://127.0.0.1','http://2130706433','http://localhost','http://[::1]','http://example.com:8000'])await assert.rejects(publicUrl(url,AbortSignal.timeout(100)));
 assert.equal(isPublicAddress('8.8.8.8'),true);
});
test('YouTube normalization is restricted to expected hosts',()=>{
 assert.equal(youtubeUrl('https://youtu.be/abcdefghijk?t=3'),'https://www.youtube.com/watch?v=abcdefghijk');
 assert.equal(youtubeUrl('https://youtube.com.evil.com/watch?v=abcdefghijk'),null);
});
test('ranking excludes submitted upload and never claims verification',()=>{
 const items=[{url:'https://youtu.be/abcdefghijk',title:'clip',text:'A distinctive phrase about solar energy.'},{url:'https://example.com/full',title:'Full speech',text:'Before: A distinctive phrase about solar energy. After: more discussion.'},{url:'javascript:alert(1)',text:'Anything'}];
 const ranked=rank(items,['distinctive phrase about solar energy'],'https://www.youtube.com/watch?v=abcdefghijk');
 assert.equal(ranked.length,1);assert.equal(ranked[0].verification,'unverified');assert.ok(ranked[0].excerpt.includes('Before:'));
});
test('summary failure retains candidates and provider text',async()=>{
 const result=await analyze({url:'',quote:'a distinctive phrase about solar energy'},{signal:new AbortController().signal,providers:{exa:{search:async()=>[{url:'https://example.com/full',title:'speech',text:'Here is a distinctive phrase about solar energy in the longer discussion.'}]},gemini:{summarize:async()=>{throw new Error('provider failure');}}}});
 assert.equal(result.status,'candidate');assert.equal(result.candidates.length,1);assert.equal(result.context.length,0);assert.ok(result.warnings.length);
});
test('cancellation prevents search work',async()=>{
 const controller=new AbortController();controller.abort();let called=false;
 await analyze({url:'',quote:'some sufficiently distinctive spoken words'},{signal:controller.signal,providers:{exa:{search:async()=>{called=true;return [];}}}});
 assert.equal(called,false);
});
test('jobs deduplicate, expire, cancel and survive refresh/restart without reprocessing',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'quantro-test-'));let calls=0;
 const run=async(input,{signal})=>{calls++;await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));return {status:'inconclusive',warnings:[],candidates:[]};};
 const store=new JobStore({directory,run,deadlineMs:40});
 try {
  const input={quote:'some words'};const a=store.create(input,'abcdefgh');assert.equal(store.create(input,'abcdefgh').id,a.id);assert.equal(calls,1);
  assert.throws(()=>store.create({quote:'other'},'abcdefgh'));
  await wait(70);assert.equal(store.get(a.id).state,'expired');
  const b=store.create(input,'ijklmnop');store.cancel(b.id);await wait(10);assert.equal(store.get(b.id).state,'cancelled');
  store.db.close();const reopened=new JobStore({directory,run,deadlineMs:40});assert.equal(reopened.get(a.id).state,'expired');assert.equal(calls,2);reopened.db.close();
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('weak generic overlaps are not source candidates',()=>{
 const result=rank([{url:'https://example.com/unrelated',title:'Unrelated',text:'The president gave a speech. This is another thing that happened.'}],['president gave an honorary visiting professor speech']);
 assert.equal(result.length,0);
});

test('spoken query skips a generic salutation without inventing words',async()=>{
 const {discoveryQueries}=await import('../backend/src/pipeline/queries.js');
 const input={basis:'youtube_segment',transcript:'Mayor, guests, ladies and gentlemen, our new telescope will measure the distant atmosphere next spring.',queries:['Mayor guests','telescope'],description:'A science presentation.'};
 const queries=discoveryQueries(input);assert.ok(queries[0].includes('our new telescope'));assert.ok(!queries[0].includes('Mayor'));assert.equal(queries.length,2);
});

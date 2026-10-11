import test from 'node:test';
import assert from 'node:assert/strict';
import {alignText,evidenceLabel,addAlignment} from '../backend/src/pipeline/alignment.js';
import {validateReport} from '../backend/src/pipeline/assessment.js';
import {videoCandidates} from '../backend/src/pipeline/videos.js';
const first='Our public library will offer free classes every weekend.';
const middle='However this proposal applies only if the council approves the funding next month.';
const last='Every resident will be welcome to attend these classes.';
const full=`Introduction to the proposal. ${first} ${middle} ${last} Questions followed.`;
test('highlights preserve original character offsets despite case and punctuation',()=>{
 const clip='OUR public library will offer free classes every weekend!';const result=alignText(clip,full);
 assert.equal(result.matches.length,1);const match=result.matches[0];
 assert.equal(clip.slice(match.clipStart,match.clipEnd),'OUR public library will offer free classes every weekend');
 assert.equal(full.slice(match.sourceStart,match.sourceEnd),'Our public library will offer free classes every weekend');
 const passage=result.passages[0];assert.equal(passage.text.slice(passage.highlightStart,passage.highlightEnd),full.slice(match.sourceStart,match.sourceEnd));
});
test('two adjacent clip passages reveal a possible internal gap, not confirmed editing',()=>{
 const result=alignText(`${first} ${last}`,full);assert.equal(result.gaps.length,1);assert.equal(result.gaps[0].text,middle);assert.equal(result.gaps[0].kind,'possible_omission');assert.equal(result.reorders.length,0);
});
test('surrounding text is not automatically an internal omission',()=>{const result=alignText(first,full);assert.equal(result.gaps.length,0);assert.equal(result.matches.length,1);});
test('reordered unique passages are distinguished from omissions',()=>{const result=alignText(`${last} ${first}`,full);assert.equal(result.reorders.length,1);assert.equal(result.gaps.length,0);});
test('repeated passages are ambiguous and cannot establish an omission',()=>{const result=alignText(`${first} ${last}`,`${first} ${middle} ${last} Another section. ${first} Different middle words appear here before the closing sentence. ${last}`);assert.equal(result.matches[0].ambiguous,true);assert.equal(result.gaps.length,0);});
test('unrelated or short fragments do not earn text match labels',()=>{const result=alignText('This is a story',full);assert.equal(evidenceLabel(result,'youtube_segment').level,'related');});
test('transcription errors reduce matches rather than being silently corrected',()=>{const result=alignText('Our private library will offer paid classes every weekend.',full);assert.equal(result.matches.length,0);});
test('assessment rejects fabricated quotes and claims unsupported by alignment',()=>{
 const transcript=`${first} ${last}`;const candidate=addAlignment({excerpt:full,sourceText:full},transcript,'user_quote');
 const raw={summary:'A possible difference.',context:[{sourceId:1,quote:'Invented words never spoken',explanation:'false'}],assessment:{findings:[{sourceId:1,kind:'possible_omission',clipQuote:first,sourceQuote:middle,effect:'Could omit the funding condition.'},{sourceId:1,kind:'possible_reordering',clipQuote:first,sourceQuote:middle,effect:'invalid'}, {sourceId:1,kind:'malicious_intent',clipQuote:first,sourceQuote:middle,effect:'invalid'}]}};
 const report=validateReport(raw,{transcript},[candidate]);assert.equal(report.context.length,0);assert.equal(report.assessment.findings.length,1);assert.equal(report.assessment.status,'potential_context_difference');assert.ok(report.assessment.intent.includes('cannot be determined'));
});
test('no transcript means no editing assessment',()=>{const candidate=addAlignment({excerpt:full},'','indexed_page');const result=validateReport({assessment:{findings:[]}},{transcript:''},[candidate]);assert.equal(result.assessment.status,'insufficient_evidence');});
test('video links are provider results, never invented timestamps or verified full recordings',()=>{
 const results=videoCandidates([{url:'https://youtu.be/abcdefghijk',title:'Full speech',text:full},{url:'https://evil.example/video',title:'Other',text:full},{url:'javascript:alert(1)',text:full}],{transcript:first,basis:'user_quote'});
 assert.equal(results.length,1);assert.equal(results[0].fullLengthVerified,false);assert.equal(results[0].url,'https://www.youtube.com/watch?v=abcdefghijk');assert.equal(results[0].evidence.level,'text_match');
});

test('video queries cannot treat an unrelated top article as the identified event',async()=>{
 const {videoQuery}=await import('../backend/src/pipeline/videos.js');
 const query=videoQuery([{title:'Unrelated convention',alignment:{matches:[]}}],{queries:['spoken phrase','distinctive tail speaker'],description:'speaker'});
 assert.equal(query,'distinctive tail speaker');
});

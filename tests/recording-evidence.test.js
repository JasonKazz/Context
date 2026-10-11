import test from 'node:test';
import assert from 'node:assert/strict';
import {hasRecordingEvidence} from '../shared/contracts.js';
import {titleEvent} from '../backend/src/pipeline/context.js';
test('generic repeated political phrases cannot promote an unrelated recording',()=>{
 assert.equal(hasRecordingEvidence({alignment:{matchedWords:18,longestRun:10,clipWords:220}}),false);
 assert.equal(hasRecordingEvidence({alignment:{matchedWords:80,longestRun:45,clipWords:220}}),true);
 assert.equal(hasRecordingEvidence({eventRelevance:-100,alignment:{matchedWords:220,longestRun:100,clipWords:220}}),false);
});
test('a bare link is not sufficient evidence, while a substantive linked transcript supports a lead',()=>{
 assert.equal(hasRecordingEvidence({linkedFrom:'https://example.org',alignment:{clipWords:220}}),false);
 assert.equal(hasRecordingEvidence({linkedFrom:'https://example.org',parentMatchedWords:219,parentLongestRun:158,alignment:{clipWords:220}}),true);
});
test('matched speech title supplies event query without unrelated photo captions',()=>{
 const title='FULL TEXT: Jane Smith’s 2022 National Convention speech';
 const clue=titleEvent([{title,excerpt:'Photo: Alex Jones celebrates at the convention the next day.',alignment:{longestRun:100}}],{});
 assert.match(clue.query,/Jane Smith/);assert.match(clue.query,/2022/);assert.doesNotMatch(clue.query,/Alex Jones/);
});
import {videoCandidates,matchEvent} from '../backend/src/pipeline/videos.js';
import {isRecordingLead} from '../shared/contracts.js';
import {publisherMetadata,publisherRecordingMetadata} from '../backend/src/pipeline/recording-links.js';
test('publisher video without transcript survives as an unverified event lead',()=>{
 const query='Jane Smith 2022 Democratic National Convention full speech video';
 const [c]=videoCandidates([{url:'https://news.example.org/video/speech',title:'Watch Jane Smith’s full speech at the 2022 DNC',text:'Clip: 18m 50s'}],{transcript:'these are the submitted words which are not indexed on the video page',basis:'user_quote'},'',query);
 assert.ok(isRecordingLead(c));assert.equal(hasRecordingEvidence(c),false);assert.equal(c.verification,'unverified');
 assert.equal(matchEvent('Alex Jones 2022 Democratic National Convention',query).supported,false);
 assert.equal(matchEvent('Jane Smith 2020 Democratic National Convention',query).supported,false);
 assert.equal(videoCandidates([{url:'https://youtube.com/',title:'Jane Smith 2022 DNC'}],{transcript:''}).length,0);
});
test('player metadata only canonicalizes supported embeds',()=>{
 const m=publisherMetadata(`<script type="application/ld+json">{"@type":"VideoObject","name":"Speech","duration":"PT18M50S","embedUrl":"https://www.youtube.com/embed/abcdefghijk"}</script><iframe src="http://localhost/private"></iframe>`);
 assert.equal(m.length,1);assert.equal(m[0].embedUrl,'https://www.youtube.com/watch?v=abcdefghijk');assert.equal(m[0].duration,'PT18M50S');
});
test('publisher fetch blocks internal destinations before network access',async()=>{
 await assert.rejects(publisherRecordingMetadata('https://127.0.0.1/private',AbortSignal.timeout(500)));
 await assert.rejects(publisherRecordingMetadata('https://localhost/private',AbortSignal.timeout(500)));
});
test('related video links cannot inherit the parent event title and publisher homepages are excluded',()=>{
 const title='Watch Jane Smith full speech at the 2022 DNC';
 const results=videoCandidates([{url:'https://news.example.org/video/speech',title,extras:{links:['https://news.example.org/video/other-speaker']}},{url:'https://station.example.org/',title}],{transcript:''},'', 'Jane Smith 2022 Democratic National Convention full speech video');
 assert.equal(results.find(c=>c.url.endsWith('other-speaker')).eventMatch.supported,false);
 assert.ok(!results.some(c=>c.url==='https://station.example.org/'));
});

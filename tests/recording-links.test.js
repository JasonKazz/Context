import test from 'node:test';
import assert from 'node:assert/strict';
import {recordingLinks,archiveRecordingLinks} from '../backend/src/pipeline/recording-links.js';
test('extracts explicit Vimeo VideoObject relation, ignores unrelated links and tokens',()=>{
 assert.deepEqual(recordingLinks(`<a href="https://vimeo.com/111">unrelated</a><script type="application/ld+json">{"@type":"VideoObject","embedUrl":"https://player.vimeo.com/video/123?turnstile=private"}</script>`),['https://vimeo.com/123']);
 assert.deepEqual(recordingLinks(`<script type="application/ld+json">{"@type":"VideoObject","embedUrl":"https://evil.example/video/123"}</script>`),[]);
});
test('archive retrieval does not follow arbitrary URLs',async()=>{assert.deepEqual(await archiveRecordingLinks('http://localhost/item/x'),[]);});

import {videoCandidates} from '../backend/src/pipeline/videos.js';
test('publisher video links retain explicit connection to a matching transcript without claiming a video match',()=>{
 const transcript='we will build a new public library for every neighborhood';
 const found=videoCandidates([{url:'https://example.edu/transcript',title:'Speech',text:transcript},{url:'https://example.edu/watch',title:'Event video',text:'Watch the event.',extras:{links:['/transcript','https://www.youtube.com/watch?v=abcdefghijk']}}],{transcript,basis:'user_quote'});
 assert.equal(found[0].url,'https://www.youtube.com/watch?v=abcdefghijk');assert.equal(found[0].transcriptUrl,'https://example.edu/transcript');assert.ok(found[0].parentMatchedWords>=6);assert.equal(found[0].alignment.matchedWords,0);assert.equal(found[0].verification,'unverified');
 const unrelated=videoCandidates([{url:'https://example.edu/watch',extras:{links:['https://www.youtube.com/watch?v=abcdefghijk']}}],{transcript,basis:'user_quote'});assert.equal(unrelated[0].parentMatchedWords,0);
});

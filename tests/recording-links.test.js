import test from 'node:test';
import assert from 'node:assert/strict';
import {recordingLinks,archiveRecordingLinks} from '../backend/src/pipeline/recording-links.js';
test('extracts explicit Vimeo VideoObject relation, ignores unrelated links and tokens',()=>{
 assert.deepEqual(recordingLinks(`<a href="https://vimeo.com/111">unrelated</a><script type="application/ld+json">{"@type":"VideoObject","embedUrl":"https://player.vimeo.com/video/123?turnstile=private"}</script>`),['https://vimeo.com/123']);
 assert.deepEqual(recordingLinks(`<script type="application/ld+json">{"@type":"VideoObject","embedUrl":"https://evil.example/video/123"}</script>`),[]);
});
test('archive retrieval does not follow arbitrary URLs',async()=>{assert.deepEqual(await archiveRecordingLinks('http://localhost/item/x'),[]);});

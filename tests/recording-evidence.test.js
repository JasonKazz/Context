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

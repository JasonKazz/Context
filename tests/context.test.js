import test from 'node:test';
import assert from 'node:assert/strict';
import {contextOptions,fallbackEvent} from '../backend/src/pipeline/context.js';
import {addAlignment} from '../backend/src/pipeline/alignment.js';
import {analyze} from '../backend/src/pipeline/analyze.js';
const quote='our public library will offer free classes every weekend';
const text='The mayor spoke at a council conference in Durham on October 9, 2026. '+quote+'. Residents without computers can borrow laptops and receive individual assistance from trained volunteers at the desk.';
const candidate=addAlignment({url:'https://example.com/speech',title:'Council conference',sourceText:text,excerpt:text},quote,'user_quote');
test('context evidence is verbatim, outside matched words, and retains attribution',()=>{const options=contextOptions([candidate],quote);assert.ok(options.some(o=>o.quote.includes('Residents without computers')));for(const o of options){assert.ok(text.includes(o.quote));assert.equal(o.sourceId,1);assert.notEqual(o.quote,quote);}});
test('event fallback uses supplied event date, not an invented date',()=>{const event=fallbackEvent([candidate],{queries:[quote]});assert.match(event.query,/October 9,? 2026/);assert.ok(text.includes(event.supportingQuote));});
test('rejected model event still searches and summary failure preserves context',async()=>{let eventSearch='';const result=await analyze({url:'',quote},{providers:{exa:{search:async()=>[{url:candidate.url,title:candidate.title,text}],videos:async()=>[],eventSources:async q=>{eventSearch=q;return [];}},gemini:{eventQuery:async()=>null,summarize:async()=>{throw new Error('summary unavailable');}}}});assert.match(eventSearch,/October 9,? 2026/);assert.ok(result.context.length);assert.ok(result.context.every(c=>text.includes(c.quote)));});
test('transcript context is prioritized and untranscribed background remains labeled',()=>{const article={...candidate,url:'https://example.com/article'};const archive={...candidate,url:'https://example.com/archive',recordingPage:true};const options=contextOptions([archive,article],quote);assert.equal(options[0].recordingTranscript,true);const background=contextOptions([{excerpt:text,url:article.url}], '');assert.ok(background.length);assert.ok(background.every(o=>o.position==='background'));});

test('event query retains speaker and date from different matching source titles',()=>{
 const sources=[{...candidate,title:'Commencement Address at Example College'},{...candidate,title:'Commencement Address at Example College May 19, 2013'},{...candidate,title:'Jane Smith - Example College Commencement Speech'}];
 const event=fallbackEvent(sources,{transcript:quote});assert.match(event.query,/Jane Smith/);assert.match(event.query,/2013/);assert.ok(event.query.length<250);
});

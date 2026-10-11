import {validateInput,MAX_FILE_BYTES} from '/shared/contracts.js';
const $=id=>document.getElementById(id);
let current=null,pollTimer,clockTimer,requestKey=null,mediaKey=null;
const labels={candidate:'Source candidates — see evidence levels',inconclusive:'Inconclusive',input_error:'Input / retrieval error'};
function text(tag,value,className){const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;}
function clearTimers(){clearTimeout(pollTimer);clearInterval(clockTimer);}
function render(job){
 current=job;document.body.classList.add('report-view');$('progress').hidden=job.state!=='running';$('stage').textContent=job.stage;
 const updateClock=()=>{const seconds=(job.elapsedMs??(Date.now()-job.createdAt))/1000;$('elapsed').textContent=`${seconds.toFixed(1)}s server`;$('bar').value=Math.min(seconds,17);};
 updateClock();clearInterval(clockTimer);if(job.state==='running')clockTimer=setInterval(updateClock,100);
 $('submit').disabled=job.state==='running';$('cancel').hidden=job.state!=='running';
 const result=job.result;
 if(job.state==='running'&&!result.candidates?.length)return;
 $('report').hidden=false;$('outcome').textContent=labels[result.status]||'Inconclusive';$('summary').textContent=result.summary;
 $('extraction').replaceChildren();
 if(result.extraction){const details=document.createElement('details');details.className='card';details.append(text('summary',`Discovery clues · ${result.extraction.basis.replaceAll('_',' ')}`),text('p',result.extraction.description||''),text('p',result.extraction.clipStructure||''),text('p',result.extraction.coverage||'','hint'),text('p',result.extraction.visualClues||'','hint'));if(result.extraction.transcript)details.append(text('blockquote',result.extraction.transcript));details.append(text('p',`Search queries: ${(result.extraction.queries||[]).join(' / ')}`,'hint'));$('extraction').append(details);}
 renderOverview(job);
 renderCandidates(result);
 renderVideos(result);
 renderAssessment(result);
 $('context').replaceChildren();
 if(result.context?.length){$('context').append(text('h3','Potential context · AI interpretation'));for(const item of result.context){const card=text('article','','card');card.append(text('span',`From source ${item.sourceId}`,'source-tag'),text('blockquote',item.quote),text('p',item.explanation));$('context').append(card);}}
 $('warnings').replaceChildren(...[...new Set(result.warnings||[])].map(w=>text('p',w)));$('warnings').hidden=!result.warnings?.length;
 $('metrics').textContent=JSON.stringify(result.metrics||{elapsedMs:job.elapsedMs},null,2);
}
function linkTo(url,title){
 const link=text('a',title);try{const parsed=new URL(url);if(['https:','http:'].includes(parsed.protocol)){link.href=parsed.href;link.target='_blank';link.rel='noopener noreferrer';}}catch{}return link;
}
function highlighted(value,ranges){
 const paragraph=text('div','','passage');let cursor=0;
 for(const range of [...ranges].sort((a,b)=>a.start-b.start)){
  if(!Number.isInteger(range.start)||!Number.isInteger(range.end)||range.start<cursor||range.end<=range.start||range.end>value.length)continue;
  paragraph.append(document.createTextNode(value.slice(cursor,range.start)));const mark=text('mark',value.slice(range.start,range.end));paragraph.append(mark);cursor=range.end;
 }
 paragraph.append(document.createTextNode(value.slice(cursor)));return paragraph;
}
function renderCandidates(result){
 $('candidates').replaceChildren();
 for(const [index,candidate] of (result.candidates||[]).entries()){
  const card=text('article','','card source-card');
  card.append(text('span',`Source ${index+1} · ${candidate.evidenceKind.replaceAll('_',' ')}`,'source-tag'),text('p',candidate.evidence?.label||'Possible source — recording not checked',`evidence-label ${candidate.evidence?.level||'related'}`));
  const heading=text('h3','');heading.append(linkTo(candidate.url,candidate.title));card.append(heading,text('p',candidate.evidence?.reason||candidate.support,'hint'));
  const alignment=candidate.alignment;
  if(alignment?.matches.length&&result.extraction?.transcript){
   const details=document.createElement('details');details.open=index===0;details.append(text('summary',`Compare matched words · ${alignment.matches.length} matching passage${alignment.matches.length===1?'':'s'}`));
   const columns=text('div','','comparison');const clip=text('div','','comparison-column');const source=text('div','','comparison-column');
   clip.append(text('h4',result.extraction.basis==='user_quote'?'Your supplied quote':'Clip transcript · provisional'),highlighted(result.extraction.transcript,alignment.matches.map(m=>({start:m.clipStart,end:m.clipEnd}))));
   source.append(text('h4','Retrieved source text · continuous excerpt'));
   if(alignment.continuous){const c=alignment.continuous;source.append(text('p',`${c.hasEarlierText?'Earlier text omitted. ':''}${c.hasLaterText?'More text follows. ':''}This page may quote a broadcast clip rather than the complete speech.`,'hint'),highlighted(c.text,c.ranges));if(c.truncatedMatches)source.append(text('p','Some matches fall beyond this bounded excerpt. Open the source for the remaining text.','hint'));}
   else
   for(const [i,passage] of alignment.passages.entries()){
    source.append(text('p',`Passage ${i+1}${passage.hasEarlierText?' · earlier source text not shown':''}`,'hint'),highlighted(passage.text,[{start:passage.highlightStart,end:passage.highlightEnd}]));
   }
   columns.append(clip,source);details.append(columns,text('p',alignment.method,'hint'));
   if(alignment.matches.some(m=>m.ambiguous))details.append(text('p','Some wording repeats in this source, so its location is ambiguous.','notice'));
   card.append(details);
   for(const gap of alignment.gaps){const details=document.createElement('details');details.className='gap';details.append(text('summary',`Possible intervening text · ${gap.wordCount} words`),text('p','This source has text between two nearby clip-transcript matches. Editing is one possible explanation; another recording or transcription differences could also explain it.','hint'),text('blockquote',gap.text));if(gap.truncated)details.append(text('p','Long passage truncated; open the source for the rest.','hint'));card.append(details);}
   if(alignment.reorders.length)card.append(text('p','Possible reordered passages: nearby clip-transcript segments occur in a different order in this source. This does not establish a video edit or intent.','gap'));
  }else card.append(text('blockquote',candidate.excerpt));
  $('candidates').append(card);
 }
 if(!result.candidates?.length)$('candidates').append(text('p','No supporting text candidate was found. Try a distinctive spoken quote.'));
}
function renderVideos(result){
 $('videos').replaceChildren();$('videos').append(text('h2','1. Recording and passage leads'));
 if(!result.videoCandidates?.length){$('videos').append(text('p','No additional video candidate is available from this run.','hint'));return;}
 $('videos').append(text('p','Timestamped transcripts can locate likely passages. Eligible YouTube recordings receive a candidate-only speech sample at an indexed timestamp, or the opening if none is available. Full length, visuals and original status remain unverified.','hint'));
 const grid=text('div','','video-grid');const leads=document.createElement('details');leads.append(text('summary','Other search leads · not established as the same recording'));const leadGrid=text('div','','video-grid');leads.append(leadGrid);let supported=0;
 for(const candidate of result.videoCandidates){const card=text('article','','card');card.append(text('span',candidate.evidence?.level==='related'?'Search lead only':'Matching indexed words · video not checked','source-tag'));const title=text('h3','');title.append(linkTo(candidate.url,candidate.title));card.append(title,text('p',candidate.evidence?.reason||candidate.support,'hint'),linkTo(candidate.url,candidate.recordingPage?'Open transcript / recording page ↗':'Open video ↗'));for(const passage of candidate.timedPassages||[]){card.append(text('p',`Matching indexed passage · ${passage.label} · ${passage.matchedWords} words`,'evidence-label'),text('p',passage.basis,'hint'));const d=document.createElement('details');d.append(text('summary','Read passage'),text('blockquote',passage.text));card.append(d);}
 if(candidate.linkedFrom)card.append(linkTo(candidate.linkedFrom,'Linked by this source page'));
 const check=candidate.videoCheck;if(check){card.append(text('p',check.status==='supported_sample'?'Appearance + spoken passage support this sample':check.status==='different_sample'?'Different appearance in the inspected sample':check.status==='speech_sample_match'?'Spoken wording matched in candidate sample · visuals unverified':'Video check inconclusive','evidence-label'),text('p',check.observations,'hint'),text('p',check.scope||'','hint'));}if(check?.status==='supported_sample'||check?.status==='speech_sample_match'||candidate.timedPassages?.length||candidate.alignment?.matchedWords>=6){grid.append(card);supported++;}else leadGrid.append(card);}
 if(!supported)$('videos').append(text('p','No recording passage was established. The remaining links are search leads, not confirmed sources.','notice'));$('videos').append(grid,leads);
}
function renderAssessment(result){
 const assessment=result.assessment;$('assessment').replaceChildren();if(!assessment)return;
 $('assessment').append(text('h2','3. What context does this add?'));
 const titles={insufficient_evidence:'Insufficient evidence to assess',potential_context_difference:'Potential context difference · AI interpretation',no_material_change_found:'No material change identified in these excerpts'};
 const card=text('div','','card');card.append(text('h3',titles[assessment.status]||titles.insufficient_evidence),text('p',assessment.reason||''),text('p',assessment.intent,'intent-note'));
 for(const finding of assessment.findings||[]){const box=text('div','','finding');box.append(text('p',`Source ${finding.sourceId} · ${finding.kind.replaceAll('_',' ')}`,'source-tag'));const pair=text('div','','comparison');const clip=text('div','');clip.append(text('h4','Clip wording'),text('blockquote',finding.clipQuote));const source=text('div','');source.append(text('h4','Source wording'),text('blockquote',finding.sourceQuote));pair.append(clip,source);box.append(pair,text('p',finding.effect));card.append(box);}
 card.append(text('p',assessment.scope,'hint'));$('assessment').append(card);
}
async function poll(id){
 try{const res=await fetch(`/api/jobs/${id}`,{signal:AbortSignal.timeout(4000)});const data=await res.json();if(!res.ok)throw new Error(data.message);render(data);if(data.state==='running')pollTimer=setTimeout(()=>poll(id),400);else clearTimers();}
 catch(error){$('error').textContent=error.message||'Connection lost. Refresh to resume viewing this job.';$('submit').disabled=false;clearTimers();}
}
function fileData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});}
$('form').addEventListener('submit',async event=>{
 event.preventDefault();clearTimers();$('error').textContent='';$('submit').disabled=true;$('report').hidden=true;
 try{
  const input={url:$('url').value,quote:$('quote').value,startSeconds:Number($('start').value)};const file=$('file').files[0];
  if(file){if(file.size>MAX_FILE_BYTES)throw new Error('Choose a clip smaller than 8 MB.');input.media={data:await fileData(file),mimeType:file.type||({mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',mp4:'video/mp4',webm:'video/webm'}[file.name.split('.').pop().toLowerCase()])};}
  const valid=validateInput(input);requestKey=crypto.randomUUID();sessionStorage.setItem('quantro-request',requestKey);
  const res=await fetch('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':requestKey},body:JSON.stringify(valid),signal:AbortSignal.timeout(15000)});const job=await res.json();if(!res.ok)throw new Error(job.message);
  sessionStorage.setItem('quantro-job',job.id);sessionStorage.setItem(`context-input-${job.id}`,JSON.stringify({url:valid.url,filename:file?.name||''}));render(job);window.scrollTo({top:0,behavior:'smooth'});await poll(job.id);
 }catch(error){$('error').textContent=error.message||'Submission failed.';$('submit').disabled=false;}
});
$('cancel').addEventListener('click',async()=>{if(!current)return;try{const res=await fetch(`/api/jobs/${current.id}`,{method:'DELETE'});render(await res.json());clearTimers();}catch{$('error').textContent='Could not send cancellation. The server deadline still applies.';}});
$('download').addEventListener('click',()=>{if(!current)return;const href=URL.createObjectURL(new Blob([JSON.stringify(current,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=href;link.download='quantro-report.json';link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);});
try{const res=await fetch('/api/health');const health=await res.json();const missing=Object.entries(health.providers).filter(([,ready])=>!ready).map(([name])=>name);$('health').textContent=missing.length?`Setup needed: ${missing.join(', ')} API key(s). Save the root .env and restart the server.`:'Gemini and Exa configured · First-pass discovery, with evidence and uncertainty.';}catch{$('health').textContent='Backend unavailable. Start the local server and refresh.';}
const saved=sessionStorage.getItem('quantro-job');const pending=sessionStorage.getItem('quantro-request');
if(pending){try{const res=await fetch(`/api/submissions/${pending}`);if(res.ok){const job=await res.json();sessionStorage.setItem('quantro-job',job.id);poll(job.id);}else if(saved)poll(saved);}catch{if(saved)poll(saved);}}else if(saved)poll(saved);

function showHome(){document.body.classList.remove('report-view');window.scrollTo({top:0,behavior:'smooth'});}
$('back').addEventListener('click',showHome);
$('home').addEventListener('click',event=>{event.preventDefault();showHome();});
for(const link of document.querySelectorAll('[data-home]'))link.addEventListener('click',()=>document.body.classList.remove('report-view'));
$('demo').addEventListener('click',()=>{
 if(current?.state==='running')return;
 showHome();$('url').value='https://www.youtube.com/watch?v=AMWqyG5ocW8';$('quote').value='';$('start').value='0';$('file').value='';$('demo-note').hidden=false;
 $('form').requestSubmit();
});
function youtubeId(value){try{const u=new URL(value);if(u.hostname==='youtu.be')return /^[\w-]{11}$/.test(u.pathname.slice(1))?u.pathname.slice(1):null;if(!['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname))return null;const id=u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})/)?.[1];return /^[\w-]{11}$/.test(id||'')?id:null;}catch{return null;}}
function mediaPanel(label,url,title,note){
 const panel=text('article','','media-panel');panel.append(text('p',label));const id=youtubeId(url);
 if(id){const preview=text('button','','video-preview');preview.type='button';preview.append(text('span','▶','play-symbol'),text('strong',title),text('span','Load YouTube player','hint'));preview.addEventListener('click',()=>{const frame=document.createElement('iframe');frame.title=label;frame.src=`https://www.youtube-nocookie.com/embed/${id}`;frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;preview.replaceWith(frame);});panel.append(preview);}
 else{const box=text('div','','media-placeholder');box.append(text('span','CONTEXT / EVIDENCE','eyebrow'),text('h3',title),text('p',note,'hint'));panel.append(box);}
 if(url)panel.append(linkTo(url,'Open source ↗'));return panel;
}
function renderOverview(job){
 const r=job.result;let input={};try{input=JSON.parse(sessionStorage.getItem(`context-input-${job.id}`)||'{}');}catch{}
 const lead=(r.videoCandidates||[]).find(c=>c.timedPassages?.length||c.alignment?.matchedWords>=6);
 const nextMediaKey=JSON.stringify([job.id,input.url,input.filename,lead?.url]);
 if(nextMediaKey!==mediaKey){mediaKey=nextMediaKey;$('media-comparison').replaceChildren(mediaPanel('Submitted excerpt',input.url||'',input.filename||'Your submitted clip',input.url?'Open the public post to watch this excerpt.':'Media is not stored for playback after analysis.'),mediaPanel('Source lead · not verified',lead?.url||'',lead?.title||'Still looking for the recording',lead?.recordingPage?'A timestamped transcript was found. Open its page to explore the recording.':'No recording with supporting passage evidence is available from this run.'));}
 const strongest=[...(r.candidates||[])].sort((a,b)=>(b.alignment?.matchedWords||0)-(a.alignment?.matchedWords||0))[0];
 const a=strongest?.alignment;const times=(r.videoCandidates||[]).reduce((n,c)=>n+(c.timedPassages?.length||0),0);
 const stats=[['Text alignment',a?`${a.matchedWords} / ${a.clipWords}`:'—','Words aligned in the strongest text source; not confidence.'],['Passage locations',String(times),'Indexed timestamp cues, not verified video timings.'],['Source leads',String(r.videoCandidates?.length||0),'Recording and transcript candidates from public search.'],['Server time',`${((job.elapsedMs||r.metrics?.elapsedMs||0)/1000).toFixed(1)}s`,'Upload, network and rendering time are additional.']];
 $('evidence-stats').replaceChildren(...stats.map(([label,value,note])=>{const card=text('div','','stat');card.append(text('span',label,'stat-label'),text('span',value,'stat-value'),text('p',note));return card;}));
}

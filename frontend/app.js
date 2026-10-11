import {validateInput,MAX_FILE_BYTES} from '/shared/contracts.js';
const $=id=>document.getElementById(id);
let current=null,pollTimer,clockTimer,requestKey=null;
const labels={candidate:'Unverified source candidates',inconclusive:'Inconclusive',input_error:'Input / retrieval error'};
function text(tag,value,className){const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;}
function clearTimers(){clearTimeout(pollTimer);clearInterval(clockTimer);}
function render(job){
 current=job;$('progress').hidden=false;$('stage').textContent=job.stage;
 const updateClock=()=>{const seconds=(job.elapsedMs??(Date.now()-job.createdAt))/1000;$('elapsed').textContent=`${seconds.toFixed(1)}s server`;$('bar').value=Math.min(seconds,17);};
 updateClock();clearInterval(clockTimer);if(job.state==='running')clockTimer=setInterval(updateClock,100);
 $('submit').disabled=job.state==='running';$('cancel').hidden=job.state!=='running';
 const result=job.result;
 if(job.state==='running'&&!result.candidates?.length)return;
 $('report').hidden=false;$('outcome').textContent=labels[result.status]||'Inconclusive';$('summary').textContent=result.summary;
 $('extraction').replaceChildren();
 if(result.extraction){const details=document.createElement('details');details.className='card';details.append(text('summary',`Discovery clues · ${result.extraction.basis.replaceAll('_',' ')}`),text('p',result.extraction.description||''));if(result.extraction.transcript)details.append(text('blockquote',result.extraction.transcript));details.append(text('p',`Search queries: ${(result.extraction.queries||[]).join(' / ')}`,'hint'));$('extraction').append(details);}
 $('candidates').replaceChildren();
 for(const [index,candidate] of (result.candidates||[]).entries()){
  const card=text('article','','card');card.append(text('span',`Source ${index+1} · ${candidate.evidenceKind.replaceAll('_',' ')} · unverified`,'source-tag'));
  const heading=text('h3','');const link=text('a',candidate.title);try{const url=new URL(candidate.url);if(['http:','https:'].includes(url.protocol)){link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';}}catch{}heading.append(link);card.append(heading,text('p',candidate.support),text('blockquote',candidate.excerpt));$('candidates').append(card);
 }
 if(!result.candidates?.length)$('candidates').append(text('p','No supporting candidate was found. Try a distinctive spoken quote.'));
 $('context').replaceChildren();
 if(result.context?.length){$('context').append(text('h3','Potential context · AI interpretation'));for(const item of result.context){const card=text('article','','card');card.append(text('span',`From source ${item.sourceId}`,'source-tag'),text('blockquote',item.quote),text('p',item.explanation));$('context').append(card);}}
 $('warnings').replaceChildren(...[...new Set(result.warnings||[])].map(w=>text('p',w)));$('warnings').hidden=!result.warnings?.length;
 $('metrics').textContent=JSON.stringify(result.metrics||{elapsedMs:job.elapsedMs},null,2);
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
  sessionStorage.setItem('quantro-job',job.id);render(job);await poll(job.id);
 }catch(error){$('error').textContent=error.message||'Submission failed.';$('submit').disabled=false;}
});
$('cancel').addEventListener('click',async()=>{if(!current)return;try{const res=await fetch(`/api/jobs/${current.id}`,{method:'DELETE'});render(await res.json());clearTimers();}catch{$('error').textContent='Could not send cancellation. The server deadline still applies.';}});
$('download').addEventListener('click',()=>{if(!current)return;const href=URL.createObjectURL(new Blob([JSON.stringify(current,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=href;link.download='quantro-report.json';link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);});
try{const res=await fetch('/api/health');const health=await res.json();const missing=Object.entries(health.providers).filter(([,ready])=>!ready).map(([name])=>name);$('health').textContent=missing.length?`Setup needed: ${missing.join(', ')} API key(s). Save the root .env and restart the server.`:'Gemini and Exa configured · First-pass discovery, with evidence and uncertainty.';}catch{$('health').textContent='Backend unavailable. Start the local server and refresh.';}
const saved=sessionStorage.getItem('quantro-job');const pending=sessionStorage.getItem('quantro-request');
if(pending){try{const res=await fetch(`/api/submissions/${pending}`);if(res.ok){const job=await res.json();sessionStorage.setItem('quantro-job',job.id);poll(job.id);}else if(saved)poll(saved);}catch{if(saved)poll(saved);}}else if(saved)poll(saved);

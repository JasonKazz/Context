import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { config } from './config.js';
import { AppError } from './errors.js';
import { analyze } from './pipeline/analyze.js';
export class JobStore {
 constructor({directory=config.dataDir,run=analyze,deadlineMs=config.deadlineMs}={}) {
  mkdirSync(directory,{recursive:true,mode:0o700});this.db=new DatabaseSync(join(directory,'jobs.sqlite'));this.active=new Map();this.run=run;this.deadlineMs=deadlineMs;
  this.db.exec('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, idem TEXT UNIQUE, hash TEXT, created INTEGER, payload TEXT)');
  for(const row of this.db.prepare('SELECT id,payload FROM jobs').all()){
   const job=JSON.parse(row.payload);if(job.state==='running'){job.state='interrupted';job.stage='Server restarted';job.result.warnings.push('Server restarted. Submit again to start a new analysis.');this.save(job);}
  }
 }
 save(job){this.db.prepare('UPDATE jobs SET payload=? WHERE id=?').run(JSON.stringify(job),job.id);}
 byKey(idem){const row=this.db.prepare('SELECT payload FROM jobs WHERE idem=?').get(idem);return row?JSON.parse(row.payload):null;}
 get(id){const row=this.db.prepare('SELECT payload FROM jobs WHERE id=?').get(id);return row?JSON.parse(row.payload):null;}
 create(input,idem){
  const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const existing=this.db.prepare('SELECT hash,payload FROM jobs WHERE idem=?').get(idem);
  if(existing){if(existing.hash!==hash)throw new AppError('IDEMPOTENCY_CONFLICT','This request ID belongs to a different submission.',409);return JSON.parse(existing.payload);}
  if(this.active.size>=2)throw new AppError('BUSY','Two analyses are already running. Wait a moment and retry.',429);
  this.db.prepare('DELETE FROM jobs WHERE created < ?').run(Date.now()-86400000);
  if(this.db.prepare('SELECT count(*) AS count FROM jobs').get().count>=200)throw new AppError('JOB_LIMIT','Local job history is full. Older jobs expire after 24 hours.',429);
  const id=randomUUID(),createdAt=Date.now();
  const job={id,createdAt,deadlineAt:createdAt+this.deadlineMs,state:'running',stage:'Starting',result:{status:'inconclusive',summary:'Analysis started.',candidates:[],context:[],warnings:[]}};
  this.db.prepare('INSERT INTO jobs VALUES (?,?,?,?,?)').run(id,idem,hash,createdAt,JSON.stringify(job));
  const controller=new AbortController();this.active.set(id,controller);
  const finish=(state,result)=>{if(job.state!=='running'||this.get(id)?.state!=='running')return;job.state=state;job.stage=state==='complete'?'Complete':state==='expired'?'Deadline reached':'Cancelled';if(result)job.result=result;job.elapsedMs=Date.now()-createdAt;this.save(job);};
  const timer=setTimeout(()=>{controller.abort();if(job.state==='running'){job.result.warnings.push('17-second processing deadline reached. Available evidence is retained.');finish('expired');}},this.deadlineMs);
  this.run(input,{signal:controller.signal,deadline:job.deadlineAt,onUpdate:update=>{if(job.state==='running'&&this.get(id)?.state==='running'){Object.assign(job,update);this.save(job);}}})
   .then(result=>finish(controller.signal.aborted?'cancelled':'complete',result))
   .catch(()=>{job.result.warnings.push('Analysis stopped unexpectedly.');finish('complete');})
   .finally(()=>{clearTimeout(timer);this.active.delete(id);});
  // Snapshot now: provider callbacks may have changed the stage synchronously.
  return this.get(id);
 }
 cancel(id){const job=this.get(id);if(!job)return null;if(job.state==='running'){
  this.active.get(id)?.abort();job.state='cancelled';job.stage='Cancelled';job.elapsedMs=Date.now()-job.createdAt;job.result.warnings.push('Cancelled by you; provider work already accepted may still be billed.');this.save(job);
 }return job;}
 shutdown(){for(const [id,controller] of this.active){controller.abort();this.cancel(id);}this.db.close();}
}

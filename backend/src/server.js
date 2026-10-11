import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {config} from './config.js';
import {JobStore} from './jobs.js';
import {AppError,publicError} from './errors.js';
import {validateInput} from '../../shared/contracts.js';
const assets=new Map([
 ['/', ['../../frontend/index.html','text/html; charset=utf-8']],
 ['/app.js',['../../frontend/app.js','text/javascript; charset=utf-8']],
 ['/style.css',['../../frontend/style.css','text/css; charset=utf-8']],
 ['/shared/contracts.js',['../../shared/contracts.js','text/javascript; charset=utf-8']],
]);
const jobs=new JobStore();
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
async function body(req){
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new AppError('CONTENT_TYPE','Use a JSON request.',415);
 const limit=Math.ceil(config.maxUploadBytes*4/3)+16384;const chunks=[];let bytes=0;
 if(Number(req.headers['content-length'])>limit)throw new AppError('TOO_LARGE','Upload a clip smaller than 8 MB.',413);
 for await(const chunk of req){bytes+=chunk.length;if(bytes>limit)throw new AppError('TOO_LARGE','Upload a clip smaller than 8 MB.',413);chunks.push(chunk);}
 try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new AppError('INVALID_JSON','The submitted request could not be read.');}
}
const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Content-Security-Policy',"default-src 'self'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; frame-ancestors 'none'; object-src 'none'; base-uri 'none'");
 try {
  // Local demo: block cross-origin requests and DNS-rebinding hostnames.
  const host=String(req.headers.host||'');
  if(![`127.0.0.1:${config.port}`,`localhost:${config.port}`,`[::1]:${config.port}`].includes(host))throw new AppError('HOST','Use localhost to access this demo.',403);
  if(req.headers.origin && req.headers.origin!==`http://${host}`)throw new AppError('ORIGIN','Cross-origin requests are disabled.',403);
  const path=new URL(req.url,'http://localhost').pathname;
  if(req.method==='GET'&&path==='/api/health')return json(res,200,{status:'ok',analysisImplemented:true,providers:{gemini:Boolean(config.geminiApiKey),exa:Boolean(config.exaApiKey)},deadlineMs:config.deadlineMs,model:config.geminiModel});
  if(req.method==='POST'&&path==='/api/jobs'){
   const idem=req.headers['idempotency-key'];if(typeof idem!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(idem))throw new AppError('IDEMPOTENCY_KEY','A submission ID is required. Refresh and retry.');
   let input;try{input=validateInput(await body(req));}catch(error){if(error instanceof AppError)throw error;throw new AppError('INVALID_INPUT',error.message);}
   return json(res,202,jobs.create(input,idem));
  }
  const submission=path.match(/^\/api\/submissions\/([a-zA-Z0-9_-]{8,100})$/);
  if(submission&&req.method==='GET'){const job=jobs.byKey(submission[1]);return json(res,job?200:404,job||{message:'No accepted job found. Submit again.'});}
  const match=path.match(/^\/api\/jobs\/([a-f0-9-]{36})$/);
  if(match&&['GET','DELETE'].includes(req.method)){const job=req.method==='DELETE'?jobs.cancel(match[1]):jobs.get(match[1]);return json(res,job?200:404,job||{code:'NOT_FOUND',message:'This job is unavailable or expired. Submit again.'});}
  const asset=assets.get(path);if(req.method!=='GET'||!asset)return json(res,404,{code:'NOT_FOUND',message:'Not found.'});
  const data=await readFile(new URL(asset[0],import.meta.url));res.writeHead(200,{'Content-Type':asset[1]});res.end(data);
 }catch(error){json(res,error.status||500,publicError(error));}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(config.port,config.host,()=>console.log(JSON.stringify({event:'server_started',port:config.port})));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(()=>{jobs.shutdown();process.exit(0);});for(const controller of jobs.active.values())controller.abort();});

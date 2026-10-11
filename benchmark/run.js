import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {analyze} from '../backend/src/pipeline/analyze.js';
import {config} from '../backend/src/config.js';
import {validateInput} from '../shared/contracts.js';
const path=process.argv[2];if(!path){console.error('Usage: npm run benchmark -- path/to/cases.json');process.exit(1);}
const cases=JSON.parse(await readFile(path,'utf8'));const reports=[];
for(const item of cases){
 // Explicit allowlist: reference answers in a case file cannot enter discovery.
 const input=validateInput({url:item.url,quote:item.quote,startSeconds:item.startSeconds});
 const begin=performance.now();const result=await analyze(input,{signal:AbortSignal.timeout(config.deadlineMs)});
 const report={label:item.label||'unnamed',runType:item.runType||'cold',totalElapsedMs:Math.round(performance.now()-begin),result};reports.push(report);
 console.log(JSON.stringify({label:report.label,elapsedMs:report.totalElapsedMs,status:result.status,candidateCount:result.candidates.length,calls:result.metrics.calls}));
}
await mkdir(resolve('benchmark/results'),{recursive:true});const output=resolve('benchmark/results',`run-${Date.now()}.json`);await writeFile(output,JSON.stringify(reports,null,2),{mode:0o600});console.log(`Local report saved: ${output}`);

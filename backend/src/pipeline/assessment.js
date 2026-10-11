import {sourcePassages} from './alignment.js';
export function emptyAssessment(reason='There is not enough aligned source text to assess a change in meaning.') {
 return {status:'insufficient_evidence',findings:[],reason,intent:'The editor’s intent cannot be determined from these materials.',scope:'Assessment applies only to the inspected clip segment and retrieved source text.'};
}
export function validateReport(raw,extraction,candidates) {
 const context=(Array.isArray(raw.context)?raw.context:[]).flatMap(item=>{
  const source=candidates[Number(item.sourceId)-1];
  if(!source||typeof item.quote!=='string'||item.quote.length<12||item.quote.length>800||!sourcePassages(source).some(p=>p.includes(item.quote)))return [];
  return [{sourceId:Number(item.sourceId),quote:item.quote,explanation:typeof item.explanation==='string'?item.explanation.slice(0,800):''}];
 });
 let assessment=emptyAssessment();
 if(extraction.transcript&&candidates.some(c=>c.alignment?.matches.length)){
  const findings=(Array.isArray(raw.assessment?.findings)?raw.assessment.findings:[]).flatMap(item=>{
   const candidate=candidates[Number(item.sourceId)-1];
   if(!candidate?.alignment?.matches.length||typeof item.sourceQuote!=='string'||item.sourceQuote.length<12||item.sourceQuote.length>800||!sourcePassages(candidate).some(p=>p.includes(item.sourceQuote)))return [];
   if(typeof item.clipQuote!=='string'||item.clipQuote.length<12||!extraction.transcript.includes(item.clipQuote))return [];
   if(!['surrounding_context','possible_omission','possible_reordering','no_material_change'].includes(item.kind))return [];
   if(item.kind==='possible_omission'&&!candidate.alignment.gaps.some(g=>g.text.includes(item.sourceQuote)))return [];
   if(item.kind==='possible_reordering'&&!candidate.alignment.reorders.length)return [];
   return [{sourceId:Number(item.sourceId),kind:item.kind,sourceQuote:item.sourceQuote,clipQuote:item.clipQuote,effect:typeof item.effect==='string'?item.effect.slice(0,1000):''}];
  }).slice(0,3);
  if(findings.length)assessment={...assessment,status:findings.some(f=>f.kind!=='no_material_change')?'potential_context_difference':'no_material_change_found',findings,reason:'AI interpretation anchored to displayed clip and source quotations; not a finding of deception.'};
 }
 return {summary:typeof raw.summary==='string'?raw.summary.slice(0,1600):'',context,assessment};
}

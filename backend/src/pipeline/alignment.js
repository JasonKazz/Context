// Deterministic text comparison, not audiovisual verification or an intent classifier.
export function tokens(text) {
 return [...String(text).matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)].map(m=>({word:m[0].toLowerCase().replaceAll('’',"'"),start:m.index,end:m.index+m[0].length}));
}
export function alignText(clipText,sourceText) {
 const clip=tokens(clipText).slice(0,800),source=tokens(sourceText).slice(0,14000),index=new Map();
 for(let j=0;j<source.length-2;j++){
  const key=source.slice(j,j+3).map(t=>t.word).join(' ');const entries=index.get(key)||[];
  if(entries.length<100)entries.push(j);index.set(key,entries);
 }
 const matches=[];
 for(let i=0;i<clip.length-5&&matches.length<12;){
  const key=clip.slice(i,i+3).map(t=>t.word).join(' ');let best=0,position=-1,ties=0;
  for(const j of index.get(key)||[]){let length=0;while(i+length<clip.length&&j+length<source.length&&clip[i+length].word===source[j+length].word)length++;
   if(length>best){best=length;position=j;ties=1;}else if(length===best)ties++;
  }
  if(best<6){i++;continue;}
  matches.push({id:`match-${matches.length+1}`,clipStart:clip[i].start,clipEnd:clip[i+best-1].end,sourceStart:source[position].start,sourceEnd:source[position+best-1].end,clipWordStart:i,sourceWordStart:position,wordCount:best,ambiguous:ties>1});i+=best;
 }
 const gaps=[],reorders=[];
 for(let i=1;i<matches.length;i++){
  const before=matches[i-1],after=matches[i];
  if(before.ambiguous||after.ambiguous)continue;
  const clipGap=after.clipWordStart-before.clipWordStart-before.wordCount;
  if(clipGap>3)continue;
  const sourceGap=after.sourceWordStart-before.sourceWordStart-before.wordCount;
  if(sourceGap>=8){const full=sourceText.slice(source[before.sourceWordStart+before.wordCount].start,after.sourceStart).trim();gaps.push({id:`gap-${gaps.length+1}`,afterMatch:before.id,beforeMatch:after.id,wordCount:sourceGap,text:full.slice(0,1800),truncated:full.length>1800,kind:'possible_omission'});}
  else if(after.sourceWordStart+after.wordCount<=before.sourceWordStart)reorders.push({beforeMatch:before.id,afterMatch:after.id,kind:'possible_reordering'});
 }
 const matchedWords=matches.reduce((sum,m)=>sum+m.wordCount,0);
 const longestRun=matches.reduce((max,m)=>Math.max(max,m.wordCount),0);
 const passages=matches.slice(0,6).map(match=>{
  const start=Math.max(0,match.sourceStart-260),end=Math.min(sourceText.length,match.sourceEnd+360);
  return {matchId:match.id,text:sourceText.slice(start,end),highlightStart:match.sourceStart-start,highlightEnd:match.sourceEnd-start,sourceCharacterStart:start,hasEarlierText:start>0,hasLaterText:end<sourceText.length};
 });
 const first=matches.length?Math.min(...matches.map(m=>m.sourceStart)):0;
 const last=matches.length?Math.max(...matches.map(m=>m.sourceEnd)):0;
 const contextStart=Math.max(0,first-600),contextEnd=Math.min(sourceText.length,Math.max(last+800,contextStart+2000),contextStart+18000);
 const continuous=matches.length?{text:sourceText.slice(contextStart,contextEnd),ranges:matches.filter(m=>m.sourceStart>=contextStart&&m.sourceEnd<=contextEnd).map(m=>({start:m.sourceStart-contextStart,end:m.sourceEnd-contextStart})),hasEarlierText:contextStart>0,hasLaterText:contextEnd<sourceText.length,truncatedMatches:matches.some(m=>m.sourceEnd>contextEnd)}:null;
 return {continuous,matches,passages,gaps,reorders,matchedWords,clipWords:clip.length,longestRun,sourceCharactersInspected:sourceText.length,method:'Exact consecutive words, ignoring case and punctuation; minimum six words. Transcription errors can prevent matches.',limitation:'Text agreement does not prove recording identity. Source text may be an article, captions or an incomplete transcript. Gaps may reflect editing, another recording or transcription differences.'};
}
export function evidenceLabel(alignment,basis) {
 if(!alignment.matches.length)return {level:'related',label:'Related source — no passage match',reason:'Search relevance only; no run of six spoken words was found in the retrieved text.'};
 const strong=alignment.longestRun>=12&&alignment.matchedWords>=alignment.clipWords*.6&&!alignment.matches.some(m=>m.ambiguous);
 return {level:strong?'strong_text':'text_match',label:strong?'Strong textual support':'Matching text found',reason:`${alignment.matchedWords} of ${alignment.clipWords} ${basis==='user_quote'?'supplied':'provisionally transcribed'} words align in runs of at least six. Longest run: ${alignment.longestRun} words. Recording match not checked.`};
}
export function addAlignment(candidate,transcript,basis) {
 const {sourceText,...publicCandidate}=candidate;
 const alignment=alignText(transcript||'',sourceText||candidate.excerpt||'');
 return {...publicCandidate,alignment,evidence:evidenceLabel(alignment,basis)};
}
export function sourcePassages(candidate){return [candidate.excerpt,...(candidate.alignment?.passages||[]).map(p=>p.text),...(candidate.alignment?.gaps||[]).map(g=>g.text)].filter(Boolean);}

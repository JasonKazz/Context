// Indexed timestamps are passage-location clues, never audiovisual verification.
import {alignText} from './alignment.js';
export function timedPassages(text,transcript){
 const cues=[...text.matchAll(/(?<![\d:])(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?![\d:])/g)].map(m=>({offset:m.index,end:m.index+m[0].length,seconds:Number(m[1]||0)*3600+Number(m[2])*60+Number(m[3]),label:m[0]}));
 const result=[];
 for(let i=0;i<cues.length;i++){
  const cue=cues[i];
  // A hyphenated cue is a start/end pair, not two transcript blocks.
  if(i&&/^\s*[-–]\s*$/.test(text.slice(cues[i-1].end,cue.offset)))continue;
  const paired=cues[i+1]&&/^\s*[-–]\s*$/.test(text.slice(cue.end,cues[i+1].offset));
  // Require explicit HH:MM:SS start/end ranges. Article publication times are not media cues.
  if(!paired||cue.label.split(':').length!==3||cues[i+1].seconds<=cue.seconds||cues[i+1].seconds-cue.seconds>600)continue;
  const next=cues[i+(paired?2:1)];const end=next?.offset??text.length;
  const passage=text.slice(paired?cues[i+1].end:cue.end,end).trim().slice(0,4000);
  const alignment=alignText(transcript,passage);
  if(alignment.longestRun>=6)result.push({startSeconds:cue.seconds,endSeconds:paired?cues[i+1].seconds:null,label:cue.label,text:passage,matchedWords:alignment.matchedWords,longestRun:alignment.longestRun,basis:'Indexed transcript timestamp; recording not verified'});
 }
 return result.sort((a,b)=>b.matchedWords-a.matchedWords).slice(0,4);
}

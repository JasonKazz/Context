// Search distinct parts of the actual speech; avoid using only a generic opening.
export function discoveryQueries(extraction) {
 const queries=[...extraction.queries];
 if(extraction.transcript && extraction.basis!=='user_quote') {
  const speech=extraction.transcript.replace(/^.*?ladies and gentlemen[,.!:\s]*/i,'').replace(/\b(?:uh|um)\b/gi,'').trim();
  const sentences=speech.split(/(?<=[.!?])\s+/);const first=sentences.find(s=>s.split(/\s+/).length>=6)||speech;
  const words=first.split(/\s+/).filter(Boolean);
  if(words.length>=6)queries[0]=`"${words.slice(0,20).join(' ').replaceAll('"','')}"`;
  const tail=speech.split(/\s+/).filter(Boolean).slice(-16).join(' ');
  if(tail&&extraction.description)queries[1]=`${tail} ${extraction.description}`.slice(0,350);
 }else if(queries.length>1&&extraction.description&&!['user_quote','title_only'].includes(extraction.basis))queries[1]=`${queries[1]} ${extraction.description}`.slice(0,350);
 return queries.slice(0,2);
}

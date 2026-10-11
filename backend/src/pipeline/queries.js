// Preserve actual spoken wording. Opening salutations often identify many unrelated speeches.
export function discoveryQueries(extraction) {
 const queries=[...extraction.queries];
 if(extraction.transcript && extraction.basis!=='user_quote') {
  const speech=extraction.transcript.replace(/^.*?ladies and gentlemen[,.!:\s]*/i,'').trim();
  const words=speech.split(/\s+/).filter(Boolean);
  if(words.length>=6)queries[0]=`"${words.slice(0,20).join(' ').replaceAll('"','')}"`;
 }
 if(queries.length>1&&extraction.description&&!['user_quote','title_only'].includes(extraction.basis))queries[1]=`${queries[1]} ${extraction.description}`.slice(0,350);
 return queries.slice(0,2);
}

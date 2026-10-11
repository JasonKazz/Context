// Runtime request validation shared with the client; no secret configuration here.
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const OUTCOMES = Object.freeze(['candidate', 'inconclusive', 'input_error']);
export function validateInput(value) {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Submit a link, short clip, or spoken quote.');
 const url = typeof value.url === 'string' ? value.url.trim() : '';
 const quote = typeof value.quote === 'string' ? value.quote.trim() : '';
 const startSeconds = Number(value.startSeconds ?? 0);
 if (url.length > 4096 || quote.length > 4000) throw new Error('The link or quote is too long.');
 if (!Number.isInteger(startSeconds) || startSeconds < 0 || startSeconds > 86400) throw new Error('Start time must be a whole number between 0 and 86400 seconds.');
 let media;
 if (value.media) {
  const {data,mimeType} = value.media;
  if (!['video/mp4','video/webm','audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/webm'].includes(mimeType)) throw new Error('Upload MP4, WebM, MP3, M4A or WAV media.');
  if (typeof data !== 'string' || data.length > Math.ceil(MAX_FILE_BYTES / 3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length%4) throw new Error('The clip must be a valid file smaller than 8 MB.');
  media={data,mimeType};
 }
 if (!url && !quote && !media) throw new Error('Add a link, short clip, or spoken quote.');
 if (url && media) throw new Error('Submit a link or a file, not both.');
 if (url) {
  let parsed; try {parsed=new URL(url);} catch {throw new Error('Enter a complete HTTP or HTTPS link.');}
  if (!['http:','https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Use a public HTTP(S) link without embedded credentials.');
 }
 return {url,quote,startSeconds,media};
}

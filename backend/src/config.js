function positiveInteger(name, fallback, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new Error(`Invalid configuration: ${name}`);
  }
  return value;
}
export const config = Object.freeze({
  host: process.env.HOST || '127.0.0.1',
  port: positiveInteger('PORT', 3100, 65535),
  deadlineMs: positiveInteger('ANALYSIS_DEADLINE_MS', 17000, 17000),
  maxUploadBytes: positiveInteger('MAX_UPLOAD_BYTES', 20971520, 20971520),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  exaApiKey: process.env.EXA_API_KEY || '',
});

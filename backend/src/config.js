import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
export const root = fileURLToPath(new URL('../../', import.meta.url));
try { loadEnvFile(resolve(root, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw new Error('Cannot load local environment file.'); }
function integer(name, fallback, max) {
 const value = Number(process.env[name] ?? fallback);
 if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error(`Invalid configuration: ${name}`);
 return value;
}
export const config = Object.freeze({
 host: process.env.HOST || '127.0.0.1', port: integer('PORT',3100,65535),
 deadlineMs: integer('ANALYSIS_DEADLINE_MS',17000,17000),
 maxUploadBytes: integer('MAX_UPLOAD_BYTES',8388608,20971520),
 geminiApiKey: process.env.GEMINI_API_KEY || '', exaApiKey: process.env.EXA_API_KEY || '',
 geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
 ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg',
 socialPython: process.env.SOCIAL_PYTHON || resolve(root,'work/social-venv/bin/python'),
 dataDir: resolve(root, 'work'),
});

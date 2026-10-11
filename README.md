# Quantro

HackNC beginner-track project: public-web source discovery for short clips, with cited excerpts and a clearly uncertain context report.

## Run locally

Node 22.13+ (tested on Node 26). `ffmpeg` is needed only for uploaded media. No npm dependencies.

1. Copy `.env.example` to `.env` **only if it does not already exist**.
2. Set `GEMINI_API_KEY` and `EXA_API_KEY` in the ignored `.env`.
3. Run `npm start` and open http://127.0.0.1:3100.

`npm test` runs deterministic tests. `npm run benchmark -- path/to/cases.json` runs uncached provider trials. Provider calls incur usage charges or consume free credits. No automatic retries or extra paid providers.

## Supported discovery routes

- Public YouTube URL: ask Gemini for discovery clues from a 30-second segment, then search Exa.
- Other public URL: retrieve accessible indexed page text with Exa; extract clues, then search. **This does not mean the video itself was watched.** Blocked/private/unindexed links may fail.
- Upload MP4/WebM/MP3/M4A/WAV up to 8 MB: extract first 30 seconds of audio locally, then Gemini and Exa.
- Optional spoken quote (also works alone): search using user-supplied words; no claim of independent transcription.

## Honest scope

All suggestions are **unverified candidates**. Excerpts come from public indexed content. AI report quotes are checked against retrieved excerpts; interpretations can still be wrong. No original-recording verification, earliest-upload determination or comprehensive fact-checking. The service uses a 17-second deadline; upload/network/render time is additional. Real accuracy and end-to-end latency require benchmarks.

## Architecture

- `frontend/`: buildless HTML/CSS/JS, polling and cancellation; no credentials.
- `backend/src/server.js`: same-origin local HTTP API and static frontend.
- `backend/src/jobs.js`: SQLite job state, idempotency, restart recovery, expiry, two active jobs maximum.
- `backend/src/config.js`: one environment loader.
- `backend/src/providers/`: Gemini and Exa adapters with bounded requests.
- `backend/src/pipeline/`: deadline-aware extraction, discovery, ranking and reporting.
- `shared/contracts.js`: runtime request validation and shared constants.
- `benchmark/`: live-provider timing; references kept separate from discovery.
- `tests/`: synthetic unit/integration tests.

## API

POST `/api/jobs` with JSON `{url, quote?, startSeconds?}` and `Idempotency-Key`; returns 202 + job ID. GET `/api/jobs/:id` polls partial/final results. DELETE `/api/jobs/:id` cancels. GET `/api/submissions/:key` recovers a submission after refresh. Inputs may alternatively contain `{media:{data:<base64>,mimeType}}`.

SQLite lives in ignored `work/` and stores reports for up to 24 hours (purged on new submissions), maximum 200 jobs. Pending jobs are marked interrupted after a restart and never automatically reprocessed. Media is temporary and cleaned after audio extraction. Cancellation stops local requests/processes where possible; external providers may continue processing accepted requests or bill them.

Localhost demo only: no authentication or public deployment is configured. The server restricts Host and Origin, rejects local/private input destinations and credential-bearing URLs, delegates URL retrieval to providers (no arbitrary server-side media fetch), and renders all text safely. Provider retrieval redirects are controlled by those providers, not this application. Logs contain stage timing/error codes, never raw URLs or provider responses.

Work on main. Old HackNCQuantro and existing deployments remain untouched.

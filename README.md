# Quantro

HackNC beginner-track project: public-web source discovery for short clips, with cited excerpts and a clearly uncertain context report.

## Run locally

Node 22.13+ (tested on Node 26). `ffmpeg` is needed only for uploaded media. No npm dependencies.

1. Copy `.env.example` to `.env` **only if it does not already exist**.
2. Set `GEMINI_API_KEY` and `EXA_API_KEY` in the ignored `.env`.
3. Run `npm start` and open http://127.0.0.1:3100.

`npm test` runs deterministic tests. `npm run benchmark -- path/to/cases.json` runs uncached provider trials. Provider calls incur usage charges or consume free credits. No automatic retries or extra paid providers.

## Supported discovery routes

- Public YouTube URL: ask Gemini for discovery clues from a up-to-180-second segment, then search Exa.
- Public Instagram Reel/post, TikTok video/share link, X/Twitter status: experimental direct retrieval with the optional setup below. Five-second retrieval deadline, 8 MB maximum, no login/browser cookies. Known durations over three minutes and unsupported streaming formats fail promptly. Unknown durations remain bounded by bytes and analysis coverage.
- Other public URL: retrieve accessible indexed page text with Exa; extract clues, then search. **This does not mean the video itself was watched.** Blocked/private/unindexed links may fail.
- Upload MP4/WebM/MP3/M4A/WAV up to 8 MB: process up to 180 seconds; video includes sampled visual frames, audio-only files are decoded locally. Then Gemini and Exa.
- Optional spoken quote (also works alone): search using user-supplied words; no claim of independent transcription.

## Optional social-video setup

The current Mac has this installed. On another machine, install Python 3.12, then:

```sh
python3.12 -m venv work/social-venv
work/social-venv/bin/python -m pip install -r backend/requirements-social.txt
```

Restart the backend. `SOCIAL_PYTHON` optionally overrides the interpreter path. The helper uses free [yt-dlp](https://github.com/yt-dlp/yt-dlp); Gemini/Exa analysis still uses existing credits. Public-site support can break or require login; this app will not import account cookies or solve challenges. Ordinary anonymous cookies issued during public retrieval stay in process memory. Silent videos are marked visual-only, never supplied with an invented transcript.

Measured support: the user's TikTok share link retrieved and completed the real-provider pipeline. An Instagram silent-video fixture retrieved successfully; Instagram speech/discovery accuracy remains untested. The X fixture failed on both default and public syndication routes, so X remains experimental with an upload fallback. See `docs/social-retrieval-results.md`.

## Honest scope

All suggestions are **unverified candidates**. Excerpts come from public indexed content. AI report quotes are checked against retrieved excerpts; interpretations can still be wrong. No original-recording verification, earliest-upload determination or comprehensive fact-checking. The service uses a 17-second deadline; upload/network/render time is additional. Real accuracy and end-to-end latency require benchmarks.

## Passage comparisons

The report highlights exact runs of at least six words in the provisional clip transcript and retrieved source text. Evidence labels explain matching word counts, not confidence percentages. Adjacent clip passages separated in a source can expose possible omissions or reordered text; these are not confirmed video edits. The AI context assessment accepts only quotations found verbatim in supplied evidence, and may return insufficient evidence. It cannot determine malicious intent.

A bounded search uses spoken wording and cited event clues to find possible longer recordings. At most two YouTube candidates receive a model comparison: 12 seconds of submitted visual reference versus the candidate’s first 90 seconds, sampled at 0.5 fps. A supported sample requires both consistent appearance and a spoken-word match of at least 12 consecutive words. Different opening scenes do not rule out a match later. Full length, exact recording identity and original status remain unchecked. Unconfirmed leads are collapsed. No full candidate videos are downloaded or transcribed.

The comparison shows one continuous, bounded source excerpt rather than duplicate overlapping windows. It may be an article or broadcast quoting the clip, not the complete original speech. Uploaded videos use Gemini inline input; coverage ending is model-reported, not independently measured. Clips longer than three minutes receive partial analysis.

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

Localhost demo only: no authentication or public deployment is configured. The server restricts Host and Origin, rejects local/private input destinations and credential-bearing URLs, uses provider retrieval for general URLs and allowlisted social extractors for bounded MP4 downloads, and renders all text safely. Provider retrieval redirects are controlled by those providers. Local social retrieval disables proxies and external processes, and checks actual connection IPs/ports to block private-network destinations including redirects. Temporary video files are deleted before analysis proceeds. Logs contain stage timing/error codes, never raw URLs or provider responses.

Work on main. Old HackNCQuantro and existing deployments remain untouched.

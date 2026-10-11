# Quantro local demo architecture

Implemented: one buildless frontend, one Node backend, SQLite job state, shared runtime input validation, isolated provider adapters, a 17-second absolute processing deadline, bounded provider calls, explicit cancellation, and partial results. No Python or frontend build tool is required; ffmpeg decodes uploaded clips.

The link route uses a public YouTube segment through Gemini when supported. Other URLs use Exa-indexed page text. The optional quote route skips extraction. Up to two Exa searches run concurrently, lexical evidence ranks up to three candidates, and Gemini writes a report only within the remaining budget. Report quotations must occur in the supplied excerpts.

No passage verification is implemented. All sources are candidates. The service never downloads full candidate recordings. Provider search/index coverage, transcription quality and source accuracy remain empirical questions.

Job state survives browser refresh. Duplicate idempotency keys return the same job; interrupted jobs are not resumed after restart. At most two analyses run at once. Cancellation aborts local requests and media processes, but providers may continue accepted work externally. The database stores local reports in ignored work/; maximum 200 records, purged after 24 hours on subsequent submissions.

Validation completed: seven deterministic tests; local HTTP checks for static assets, health, idempotency, cross-origin rejection, and blocking .env/database access; browser checked private-address rejection. These are not accuracy or latency benchmarks. Real-provider trials are pending saved API credentials.

Next experiment: four unseen accessible clips and one unavailable input, each with an independently substantiated reference kept outside discovery. Record cold/warm runs separately, top-three source correctness, wrong candidates, unsupported verification claims, provider calls/costs, stage timings, and total browser time including upload. Compare with ChatGPT search. The 17-second server deadline does not establish a universal 20-second end-to-end response.

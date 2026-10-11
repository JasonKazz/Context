# Proposed architecture (not yet implemented)

One frontend and one Node backend, served from the same origin. Plain JavaScript avoids a build tool during the initial experiment; add a framework only when justified. Provider adapters remain independent of HTTP handlers so the benchmark and future Photon/Spectrum adapter can call the same analysis service.

## First milestone

Benchmark short unseen clips before building the analysis UI. Extract distinctive speech, run at most two search queries concurrently, rank concrete evidence, locate accessible transcript passages, and verify only a relevant media passage when feasible. Never download/transcribe full candidate recordings by default.

Proposed server budget: retrieval 3 s, speech 5 s, search 3 s, evidence 2 s, optional verification 3 s, reporting 1 s. Absolute deadline 17 s includes queue time; 3 s network/render allowance is a hypothesis. Measure user-perceived time including uploads separately. Fast errors do not count as successful discovery.

## Next API

- POST /api/jobs: validate bounded input; idempotency key; return 202 + job ID immediately.
- GET /api/jobs/:id: progress, partial evidence, terminal outcome.
- DELETE /api/jobs/:id: cancel work and child processes where possible.

These routes currently return 501. Persist job identities and terminal results in SQLite when implementing jobs; refresh must reuse job IDs. Expired or interrupted jobs must not restart implicitly. Use one bounded worker pool; no separate queue service.

## Implementation safeguards

Public HTTP(S) only, validate DNS and each redirect, block private/loopback/link-local destinations, cap bytes/duration/redirects and media-process resources, clean temporary files. Propagate cancellation and the absolute deadline to every adapter; use no retries in the initial experiment. Do not log credentials, query contents, submitted/signed URLs, media text, or messages. Log stage names, elapsed milliseconds, call counts, estimated cost, and sanitized error codes.

Treat retrieved content as data, never instructions. Captions and snippets are discovery clues, not recording verification. A verified passage requires actual media comparison with recorded evidence; matching upload is not earliest original. Context may leave meaning unchanged. Return uncertain candidates, verified passages, inconclusive explanations, or actionable errors. No invented confidence percentages.

## Validation

Keep deterministic unit fixtures separate from real-provider benchmarks. Report cold and warm runs separately, top-three source accuracy, incorrect suggestions, false verification, retrieval failures, deadline exits, evidence, call counts, estimated cost and per-stage/total timing. Reference answers never enter discovery. Compare against ChatGPT with search. No real-provider benchmark has run yet.

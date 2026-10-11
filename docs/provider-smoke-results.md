# Real-provider smoke tests — October 10, 2026

These are development smoke tests, not an unseen-clip accuracy benchmark. No local result cache was used by the direct analysis calls, but providers may cache responses. Repeated inputs are explicitly identified below. No recording identity was verified.

| Input | Service elapsed | Result |
| --- | ---: | --- |
| Famous JFK Moon speech quote | 0.823 s | Exa returned JFK Library/Rice sources; Gemini 2.5 Flash-Lite returned 404. |
| Rice University speech page, first page-route run | 2.637 s | Candidates and AI report using indexed text; not video analysis. |
| Public JFK YouTube recording, first segment-route run | 3.348 s | Discovery failure: unrelated results from generic greeting queries. |
| Same YouTube segment, repeated after query changes | 3.716 s | Relevant speech pages in first two results, unrelated Kennedy speech in third. All unverified. |

Changes motivated by these failures: use Gemini 3.5 Flash-Lite after a successful connectivity probe; include model-derived identifying clues alongside the spoken wording; reject weak lexical overlap; select excerpt windows with more matching words; force page-route transcripts to remain empty and instruct reporting to distinguish indexed text from inspected audio.

The repeated video result is not a cold-run success rate. Browser end-to-end timing and a held-out benchmark with crops, edits, misleading captions, private/unavailable clips, and independent reference answers remain to be measured. Provider generation is not independent recording verification.

The successful page run used 3 Exa calls ($0.015 reported) and 2 Gemini calls (about $0.0019 estimated). Pricing basis: https://exa.ai/docs/admin/pricing and https://ai.google.dev/gemini-api/docs/pricing . Billing tiers/free credits and failed/cancelled requests may change actual charges.

Google lists access restrictions on older 2.5 models for new projects: https://ai.google.dev/gemini-api/docs/models . The selected 3.5 Flash-Lite model passed a real request with this local account.

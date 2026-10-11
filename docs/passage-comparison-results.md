# Passage comparison smoke tests

These are development retests, not held-out accuracy measurements or cold-run guarantees. No local analysis-result cache was used; upstream provider caching is unknown. Reference answers did not enter discovery.

| Input | Pipeline elapsed | Observed evidence |
|---|---:|---|
| User Obama short, initial query | 3.025s | Related sources only; no passage match. |
| JFK development example | 3.321s | 36/46 transcribed words aligned; three text-supported candidates; two video leads had indexed text matches. |
| Obama after distinctive-query adjustment | 3.028s | Two pages matched 27/28 transcribed words. Third speech reused only 12 words. No original recording confirmed. |
| Obama through localhost browser | 3.665s server | Highlights and surrounding text rendered; video leads clearly unchecked; assessment correctly abstained from an unsupported conclusion. |

Real calls used Gemini and Exa, approximately 2 Gemini and 4 Exa calls per completed enriched run, roughly 2.3–2.4 US cents in the recorded CLI trials. Provider accounting may omit failed/cancelled costs. Browser timing above is server time, not instrumented click-to-render time.

The Obama text provides additional discussion of young activists, injustice and the anti-apartheid movement. This is visible evidence from candidate transcripts, not independent authentication of the event. Current video leads can be unrelated. No earliest original has been established. The model produced no validated context-effect findings on these real clips; that feature is implemented and deterministically tested but its real-world usefulness is not established.

20 deterministic tests pass, including character offsets, synthetic omissions and reordering, ambiguity, fabricated-quotation rejection, cancellation, persistence and deduplication. Synthetic omission tests do not establish performance on edited real videos. No false recording verification was emitted because audiovisual verification is not implemented.

Remaining benchmark work: independently substantiated unseen sources; cropped/edited clips; misleading overlays; provider-side unavailable media; separated cold/warm runs and measured browser elapsed time. The 17-second deadline remains a bound on server work, not a promise of successful discovery.

## Expanded coverage and visual checks

Current user input: public CBS YouTube short `G2nWIaeME4g`. The former 30-second extraction stopped during a follow-up question. Requesting up to 180 seconds returned the later question about China/COVID and the response. The model reported reaching the end; this is not independent duration verification.

Development runs: 6.703s for extraction, search and one visual mismatch check; 4.877s for an event-query variant that returned only uncheckable C-SPAN leads; 7.609s after separate YouTube and C-SPAN searches with two candidate checks. The last CLI run cost approximately $0.037 (5 Exa and 5 Gemini calls). These are repeated development inputs, not cold/held-out or browser end-to-end measurements.

The checks identified airplane/news-studio samples as visually inconsistent. No full original was established. A candidate can begin with other footage and contain the matching passage later, so mismatch labels apply only to the inspected sample. The model also misread a visible date in one extraction: visual clues are fallible. The final implementation compares submitted frames directly with candidate frames, rather than relying solely on textual appearance descriptions.

23 deterministic tests now pass, including continuous excerpts and the requirement that visual similarity alone cannot support a video sample. Full three-minute input latency and uploaded-video quality are not established by these short-clip tests.

Provider capabilities were checked against official [Gemini video documentation](https://ai.google.dev/gemini-api/docs/video-understanding) and [Exa contents documentation](https://exa.ai/docs/reference/get-contents). No additional provider or subscription was introduced.

Final browser smoke test with direct reference/candidate frames: 7.766s server time. Both inspected candidate openings showed different settings, so neither was promoted. The continuous highlighted excerpt and complete short-clip transcript rendered correctly. A subsequent deterministic venue-ranking improvement is unit-tested; its effect on live search accuracy remains unmeasured.

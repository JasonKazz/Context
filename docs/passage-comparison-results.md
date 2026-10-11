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

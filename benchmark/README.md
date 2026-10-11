# Real-provider benchmark

Run `npm run benchmark -- path/to/cases.json` with an array of objects containing label, url (or quote), optional startSeconds, and runType (cold/warm). Each run invokes providers afresh, bypassing job reuse. Outputs are ignored under results/. Reference answers stay in references/ and are never sent to discovery. The runner explicitly selects input fields.

Use four independently substantiated unseen clips plus one unavailable input. Include edits, crops and misleading captions. Assess top-three source correctness manually against the separate references. No successful real-provider runs are claimed until reported.

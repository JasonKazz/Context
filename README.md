# Quantro

Clean HackNC beginner-track rebuild for finding longer sources of short video clips and explaining surrounding context with evidence.

## Current status

Runnable frontend/backend skeleton only. No provider calls, video retrieval, job processing, or verification is implemented. The 20-second user-response goal is unmeasured.

## Run

Use Node.js 22 or newer. No dependencies are needed for this skeleton.

```sh
cp .env.example .env # only if .env does not already exist
npm start
```

Open http://127.0.0.1:3100. `npm run check` checks JavaScript syntax. Keep provider credentials in the ignored root `.env` only. `.gitignore` is a file, not a folder.

## Layout

- `frontend/`: lightweight web interface; no credentials.
- `backend/src/`: server and single configuration loader.
- `backend/src/pipeline/`: retrieval, extraction, discovery, ranking, verification, reporting boundaries.
- `backend/src/providers/`: server-only provider adapters.
- `shared/`: proposed JSON request/result contracts; not yet enforced at runtime.
- `benchmark/`: future real-provider experiment, separate from unit fixtures.
- `tests/fixtures/`: deterministic synthetic fixtures.
- `docs/architecture.md`: next implementation steps and evidence rules.

Work on main. The old HackNCQuantro repository is read-only reference. Do not change existing deployments.

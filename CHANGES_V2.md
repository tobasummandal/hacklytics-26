# What's new since the hackathon (v2)

The hackathon submission was a working prototype. v2 is the polished version.

## Frontend

- Replaced the three separate panels (CharacterPanel, InconsistencyPanel, LoopholePanel) with a single unified `FlagPanel` that surfaces all consistency alerts in one place.
- `WorldGraph` now has a node-type legend and per-type filtering so you can isolate characters, locations, objects, etc.
- The world-graph panel is vertically resizable by dragging.
- Progress bar tracks ingest completion at chunk granularity instead of going 0→100 in one jump.

## Backend

- `/ingest` now queues work as a background job and returns a job ID immediately. A new `/ingest/status/{job_id}` endpoint reports progress so the UI can poll.
- Ingest is more robust: errors are caught per-chunk and logged rather than aborting the whole job.
- Improved LLM prompts for both extraction and consistency checking; highlights in the UI are tighter.

## Dev experience

- `./dev-up.sh` starts the VectorAI container, backend, and frontend in the right order with health-checks.
- `./dev-up.sh --background` detaches immediately and writes logs to `.run/`.
- `./dev-down.sh` tears everything down cleanly.

## Cloud deployment

- `render.yaml` Render blueprint: one-click deploy of the backend and a VectorAI sidecar on Render.
- `DEPLOY_RENDER.md` documents the full deploy flow.

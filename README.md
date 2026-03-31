# Throughline

AI-powered story consistency checker. Detects character contradictions in real time as an author writes.

## Requirements

- Python 3.11+
- Docker

## One-command dev run

From repo root:
```bash
./dev-up.sh
```

Start in background and return to your shell immediately:
```bash
./dev-up.sh --background
```

Stop everything:
```bash
./dev-down.sh
```

This starts:
- VectorAI Docker container on `50051`
- Backend API on `http://127.0.0.1:8000`
- Frontend app on `http://127.0.0.1:5173`

Logs are written to `.run/backend.log` and `.run/frontend.log`.

## Setup

**1. Start the vector database**
```bash
docker run -d --name vectoraidb -p 50051:50051 williamimoh/actian-vectorai-db:1.0b
```

**2. Clone and enter the backend**
```bash
cd backend
```

**3. Create a virtual environment**
```bash
python3 -m venv venv
source venv/bin/activate
```

**4. Install dependencies**
```bash
pip install -r requirements.txt
```

**5. Install the Actian Python client**
```bash
curl -L -o actiancortex-0.1.0b1-py3-none-any.whl \
  "https://raw.githubusercontent.com/hackmamba-io/actian-vectorAI-db-beta/main/actiancortex-0.1.0b1-py3-none-any.whl"

pip install actiancortex-0.1.0b1-py3-none-any.whl
```

**6. Configure environment**

Edit `.env` in the project root:
```
VECTORAI_HOST=localhost
VECTORAI_PORT=50051
GEMINI_API_KEY=your-key-here
```

Get a free Gemini API key at https://aistudio.google.com

**7. Start the server**
```bash
uvicorn main:app --reload --port 8000
```

API is live at http://localhost:8000
Docs at http://localhost:8000/docs

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ingest` | Ingest a passage of text into the knowledge graph |
| `POST` | `/who` | Detect which known characters are present in a passage |
| `POST` | `/check` | Run consistency check on new text |
| `GET` | `/graph/{name}` | Get full character profile + relationships |
| `DELETE` | `/reset` | Wipe all data and start fresh |
| `GET` | `/health` | Health check |

## Usage flow

```bash
# 1. ingest some story text
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{"text": "your story passage here", "chapter": 1}'

# 2. as author writes, detect who is present
curl -X POST http://localhost:8000/who \
  -H "Content-Type: application/json" \
  -d '{"text": "last 3-4 lines the author just wrote"}'

# 3. run consistency check
curl -X POST http://localhost:8000/check \
  -H "Content-Type: application/json" \
  -d '{"text": "last 3-4 lines", "characters_present": ["Sarah", "John"], "chapter": 2}'
```

## What's new since the hackathon (v2)

The hackathon submission was a working prototype. v2 is the polished version.

**Frontend overhaul**
- Replaced the three separate panels (CharacterPanel, InconsistencyPanel, LoopholePanel) with a single unified `FlagPanel` that surfaces all consistency alerts in one place.
- `WorldGraph` now has a node-type legend and per-type filtering so you can isolate characters, locations, objects, etc.
- The world-graph panel is vertically resizable by dragging.
- Progress bar tracks ingest completion at chunk granularity instead of going 0→100 in one jump.

**Backend: async ingest**
- `/ingest` now queues work as a background job and returns a job ID immediately. A new `/ingest/status/{job_id}` endpoint reports progress so the UI can poll.
- Ingest is more robust: errors are caught per-chunk and logged rather than aborting the whole job.
- Improved LLM prompts for both extraction and consistency checking; highlights in the UI are tighter.

**One-command dev experience**
- `./dev-up.sh` starts the VectorAI container, backend, and frontend in the right order with health-checks.
- `./dev-up.sh --background` detaches immediately and writes logs to `.run/`.
- `./dev-down.sh` tears everything down cleanly.

**Cloud deployment**
- `render.yaml` Render blueprint: one-click deploy of the backend and a VectorAI sidecar on Render.
- `DEPLOY_RENDER.md` documents the full deploy flow.

## Stack

- **FastAPI** — API server
- **SQLite** — entities, attributes, relationships
- **Actian VectorAI DB** — behavioral embedding vectors
- **Gemini 2.5 Flash** — extraction and consistency checking
- **Gemini Embedding 001** — 3072-dim text embeddings

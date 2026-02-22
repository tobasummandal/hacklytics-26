# Throughline

AI-powered story consistency checker. Detects character contradictions in real time as an author writes.

## Requirements

- Python 3.11+
- Docker

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

## Stack

- **FastAPI** — API server
- **SQLite** — entities, attributes, relationships
- **Actian VectorAI DB** — behavioral embedding vectors
- **Gemini 2.5 Flash** — extraction and consistency checking
- **Gemini Embedding 001** — 3072-dim text embeddings

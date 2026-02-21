# Pure Imagination - Setup Guide

An AI-powered world-building assistant that helps authors maintain consistency, detect loopholes, and visualize the "physics" of their fictional universes.

## Prerequisites

- Docker & Docker Compose (recommended) OR
- Python 3.11+ and Node.js 20+ (for local development)
- OpenAI API Key (optional, but recommended for best results)

## Quick Start with Docker

1. Clone the repository and navigate to the project directory

2. Create a `.env` file:
```bash
cp .env.example .env
```

3. Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=your_key_here
```

4. Start all services:
```bash
./start.sh
```

This will start:
- Actian VectorAI DB on port 50051
- Backend API on port 8000
- Frontend UI on port 8080

5. Open your browser and go to: http://localhost:8080

## Local Development Setup

If you prefer to run without Docker:

1. Create `.env` file as above

2. Start the backend:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

3. In a new terminal, start the frontend:
```bash
cd frontend
npm install
npm run dev
```

4. You'll need to run Actian VectorAI DB separately (see Actian documentation)

## Using the Application

### 1. Create a World

- Open the application in your browser
- Enter a name for your fictional world
- Optionally add a description
- Click "Create World"

### 2. Upload Your Manuscript

- Click the "Upload" tab
- Drag and drop or click to select a `.docx` or `.txt` file
- Click "Upload & Process"
- Wait for processing to complete

### 3. Explore Features

**World Map Tab**
- Interactive graph visualization showing relationships between rules
- Nodes represent rules/characters, edges show semantic similarity
- Click and drag to explore connections

**Inconsistencies Tab**
- View detected contradictions in your world-building
- Severity levels: High, Medium, Low
- Citations showing exact chapters/pages

**Loopholes Tab**
- Discover creative exploits in your rule systems
- Cross-system loopholes combining different rule types
- Use intentionally or close them

**Characters Tab**
- Track character traits, abilities, and motivations
- Consistency scores show character behavior drift
- Warnings for potential inconsistencies

## API Documentation

Once the backend is running, visit:
- http://localhost:8000/docs - Interactive API documentation (Swagger)
- http://localhost:8000/redoc - Alternative documentation

## Technology Stack

- **Frontend**: React, TypeScript, TailwindCSS, vis.js
- **Backend**: Python, FastAPI, sentence-transformers
- **Database**: Actian VectorAI DB (vector search & embeddings)
- **AI**: OpenAI GPT-4 (optional, falls back to rule-based)

## Troubleshooting

**Docker Issues**
- Make sure Docker is running
- Try `docker-compose down` and restart

**Port Conflicts**
- If ports are in use, edit `docker-compose.yml` to change port mappings

**API Key Issues**
- The system works without an API key but with reduced accuracy
- With API key: LLM-powered rule extraction and analysis
- Without API key: Keyword-based fallback methods

**No VectorAI Connection**
- Ensure the VectorAI container is running
- Check logs: `docker-compose logs vectorai`

## Sample Data

For testing, you can use any fictional manuscript. The system works best with:
- Clear world-building rules
- Defined magic/political/economic systems
- Multiple characters with established traits
- At least 20-30 paragraphs of content

## Project Structure

```
hacklytics-26/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── services/            # Core services
│   │   ├── vectorai.py      # Vector DB integration
│   │   ├── ingestion.py     # Document processing
│   │   ├── rule_extraction.py
│   │   ├── inconsistency.py
│   │   ├── loophole.py
│   │   └── character.py
│   └── models/
│       └── schemas.py       # Pydantic models
├── frontend/
│   └── src/
│       ├── components/      # React components
│       ├── api/             # API client
│       └── types/           # TypeScript types
└── docker-compose.yml       # Service orchestration
```

## Contributing

This is a hackathon project built for Actian VectorAI DB Hackathon 2026.

## License

MIT License

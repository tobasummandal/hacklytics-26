# Pure Imagination - Quick Start

Get up and running in 5 minutes!

## Option 1: Docker (Recommended)

```bash
# 1. Create environment file
cp .env.example .env

# 2. Add your OpenAI API key to .env (optional but recommended)
# Edit .env and set: OPENAI_API_KEY=your_key_here

# 3. Start everything
./start.sh

# 4. Open browser
open http://localhost:8080
```

## Option 2: Local Development

```bash
# Terminal 1 - Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

Then open: http://localhost:8080

## First Steps in the App

1. **Create a World**
   - Enter a name like "The Eternal Empire"
   - Click "Create World"

2. **Upload a Manuscript**
   - Click the "Upload" tab
   - Use the provided `sample-manuscript.txt` or your own .docx/.txt file
   - Click "Upload & Process"
   - Wait ~30 seconds for processing

3. **Explore Results**
   - **World Map**: See the knowledge graph of your world's rules
   - **Inconsistencies**: Find contradictions (e.g., "only Blood Moon born can use fire magic" vs "Aria cast a fireball")
   - **Loopholes**: Discover creative exploits (e.g., nobles + magic immunity)
   - **Characters**: Track character consistency scores

## Example Inconsistencies You'll Find

Using the sample manuscript, the system will detect:

🔴 **HIGH SEVERITY**
- Rule: "Only Blood Moon born can wield fire magic" (Ch. 1)
- Rule: "Aria, born in summer, cast a fireball" (Ch. 5)
- **Issue**: Direct contradiction in magic system

⚠️ **MEDIUM SEVERITY**
- Rule: "Empire has no standing army" (Ch. 6)
- Rule: "Ten thousand Imperial soldiers guard the capital" (Ch. 6)
- **Issue**: Contradictory military policy

🔓 **LOOPHOLE DETECTED**
- System: Magic + Politics
- **Exploit**: Nobles with diplomatic immunity can use forbidden magic without magical binding consequences
- **Fix**: Either remove immunity or add magic-specific penalties

## API Access

Interactive API documentation:
- http://localhost:8000/docs (Swagger UI)
- http://localhost:8000/redoc (ReDoc)

## Testing the API

```bash
# Create a world
curl -X POST http://localhost:8000/worlds \
  -H "Content-Type: application/json" \
  -d '{"name": "Test World"}'

# Upload a manuscript (replace WORLD_ID)
curl -X POST http://localhost:8000/worlds/WORLD_ID/upload \
  -F "file=@sample-manuscript.txt"

# Get inconsistencies
curl http://localhost:8000/worlds/WORLD_ID/inconsistencies
```

## Troubleshooting

**Can't connect to VectorAI DB?**
- Make sure Docker is running
- Check: `docker ps` should show vectorai container

**No results appearing?**
- Wait 30-60 seconds after upload for processing
- Check browser console for errors
- Verify WebSocket connection (green icon in header)

**Without OpenAI API Key?**
- System still works with fallback methods
- Results are less accurate but functional
- Keyword-based rule extraction instead of LLM

## What's Next?

- Try your own manuscripts
- Experiment with different world types (sci-fi, fantasy, etc.)
- Check out `ARCHITECTURE.md` for technical details
- Explore `SETUP.md` for advanced configuration

## Support

This is a hackathon project for Actian VectorAI DB Hackathon 2026.
Built with: React, FastAPI, Actian VectorAI DB, sentence-transformers, OpenAI GPT-4.

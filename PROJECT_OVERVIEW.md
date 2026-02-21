# Pure Imagination - Project Overview

## Hackathon Submission for Actian VectorAI DB Hackathon 2026

**Pure Imagination** is an AI-powered world-building assistant that helps authors maintain consistency, detect loopholes, and visualize the "physics" of their fictional universes using semantic search and vector embeddings.

## 🎯 Problem Statement

Authors building complex fictional worlds face a fundamental challenge: **maintaining internal consistency across hundreds of pages**. Plot holes, contradictions, and inconsistencies can ruin reader immersion and are difficult to catch manually.

## 💡 Our Solution

Pure Imagination treats world-building rules as **semantic data** — storing them in Actian VectorAI DB, clustering them by meaning, and surfacing contradictions before they become plot holes.

## ✨ Key Features

### 1. Real-Time Ingestion 📖
- Upload .docx or .txt manuscripts
- Automatic paragraph chunking and embedding
- Real-time ingestion into VectorAI DB
- Builds a living knowledge base of world rules

### 2. World Topology Map 🗺️
- Interactive knowledge graph visualization
- Rules clustered into systems (Magic, Politics, Technology, Economy)
- Nodes = rules/characters, Edges = semantic proximity
- Physics-based layout using vis.js

### 3. Inconsistency Detection ⚠️
- Semantic search finds similar rules
- LLM-powered contradiction analysis
- Severity levels (HIGH, MEDIUM, LOW)
- Citations to exact chapters/pages

### 4. Loophole Generator 🔓
- Cross-system analysis
- Finds creative exploits between rule systems
- Helps authors intentionally use or close loopholes
- Creativity scoring

### 5. Character Schema Tracker 👤
- Dynamic knowledge base per character
- Tracks traits, morals, abilities, relationships
- Consistency scoring
- Flags character behavior drift

### 6. Writer's Block Breaker 💡
- Natural language queries
- "What happens if fire magic + political immunity?"
- Contextually grounded suggestions

## 🏗️ Technical Architecture

### Frontend
- **React 18** + **TypeScript** - Modern, type-safe UI
- **TailwindCSS** - Rapid styling and responsive design
- **vis.js Network** - Interactive graph visualization
- **Vite** - Fast development server

### Backend
- **Python 3.11** + **FastAPI** - High-performance async API
- **sentence-transformers** - 384-dim embeddings (all-MiniLM-L6-v2)
- **python-docx** - Document parsing
- **OpenAI GPT-4** - LLM-powered analysis (with fallbacks)
- **WebSockets** - Real-time updates

### Database
- **Actian VectorAI DB** (actiancortex) - Core semantic backbone
- **HNSW index** - Millisecond-latency K-NN search
- **COSINE distance** - Optimal for text similarity
- **Filter DSL** - Combined semantic + metadata queries

### Infrastructure
- **Docker Compose** - One-command deployment
- **Multi-container** - VectorAI DB, Backend, Frontend
- **Volume persistence** - Data survives restarts

## 📊 Data Flow

```
Manuscript → Parse → Embed → VectorAI DB → Extract Rules → 
Semantic Search → LLM Analysis → Inconsistencies + Loopholes + Characters
```

## 🎓 Actian VectorAI DB Usage

### Collections (4 per world)
1. **chunks** - Raw manuscript paragraphs
2. **rules** - Extracted world-building rules
3. **characters** - Character traits and mentions
4. **settings** - Locations and environments

### Key Operations
- `create_collection()` - Initialize typed collections
- `batch_upsert()` - High-throughput ingestion
- `search()` - K-NN semantic search
- `search_filtered()` - Semantic + metadata filtering
- `scroll()` - Full collection pagination

### Why VectorAI DB?
Traditional databases tell you if two rules share the same **words**.
VectorAI DB tells you if two rules share the same **meaning** — even when phrased differently.

This is the foundation of inconsistency detection: find rules that mean similar things but say contradictory things.

## 🚀 Innovation Highlights

1. **Cross-System Loophole Detection** - Novel approach combining rules from different systems (magic + politics) to find creative exploits
2. **Character Consistency Tracking** - Dynamic schema that evolves with each mention
3. **Real-Time Graph Updates** - WebSocket streaming of knowledge graph as author writes
4. **Semantic Contradiction Detection** - Combines vector similarity with LLM reasoning
5. **Dual-Mode Operation** - Works with or without API keys (graceful degradation)

## 📈 Scalability

- Each world is isolated (separate collections)
- HNSW enables O(log n) search even with 100k+ rules
- Async FastAPI supports high concurrency
- Batch operations optimize throughput
- VectorAI DB handles millions of vectors

## 🎯 Hackathon Criteria Alignment

✅ **RAG System** - Retrieval-Augmented Generation for rule analysis
✅ **Semantic Search** - Core feature using VectorAI DB
✅ **Real-time AI Solution** - WebSocket updates during ingestion
✅ **Creative Implementation** - Loophole generation is unique
✅ **Filter DSL Usage** - System-based rule filtering
✅ **Batch Operations** - Efficient bulk ingestion

## 📦 Deliverables

- ✅ Full-stack application (frontend + backend)
- ✅ Docker Compose setup (one-command start)
- ✅ Comprehensive documentation
- ✅ Sample manuscript for testing
- ✅ Setup guides (Quick Start, Setup, Architecture)
- ✅ Working demo with all features

## 🎬 Demo Scenario

1. Author uploads 500-page fantasy manuscript
2. System ingests and extracts 200+ world rules
3. Detects inconsistency: "Only Blood Moon born use fire magic" vs "Summer-born Aria casts fireball"
4. Generates loophole: "Nobles with diplomatic immunity + forbidden magic = legal loophole"
5. Character tracker flags: "Aria's alignment shifted from Lawful to Chaotic"
6. Graph shows dense cluster of magic rules with few political connections

## 📁 Project Structure

```
hacklytics-26/
├── backend/              # FastAPI server
│   ├── main.py          # API endpoints
│   ├── services/        # Core logic
│   └── models/          # Data schemas
├── frontend/            # React application
│   └── src/
│       ├── components/  # UI components
│       ├── api/         # API client
│       └── types/       # TypeScript types
├── docker-compose.yml   # Service orchestration
├── sample-manuscript.txt # Test data
├── QUICKSTART.md        # 5-minute guide
├── SETUP.md             # Detailed setup
└── ARCHITECTURE.md      # Technical deep-dive
```

## 🏆 What Makes This Special

1. **Novel Use Case** - First vector DB for fiction consistency checking
2. **Practical Value** - Solves real problem for authors
3. **Full-Stack Polish** - Production-quality UI/UX
4. **Intelligent Fallbacks** - Works without expensive API keys
5. **Extensible Design** - Easy to add new rule types or systems

## 🔮 Future Possibilities

- Multi-document support (track entire series)
- Timeline analysis (temporal consistency)
- Character arc visualization
- Collaborative world-building
- Export to LaTeX/PDF reports
- Browser extension for Google Docs

## 📄 License

MIT License

## 👥 Team

Built for Actian VectorAI DB Hackathon 2026

## 🙏 Acknowledgments

- Actian for VectorAI DB and hackathon opportunity
- sentence-transformers for efficient embeddings
- vis.js for beautiful graph visualizations
- FastAPI and React communities

---

**Try it now**: `./start.sh` → http://localhost:8080

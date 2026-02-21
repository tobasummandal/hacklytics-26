# Pure Imagination - Architecture Overview

## System Architecture

Pure Imagination is a full-stack application that uses vector embeddings and semantic search to analyze fictional world-building consistency.

### High-Level Flow

```
┌─────────────┐
│   Author    │
│  Manuscript │
└──────┬──────┘
       │ Upload (.docx/.txt)
       ▼
┌─────────────────────────────────┐
│   Frontend (React + TypeScript) │
│   - File Upload                 │
│   - Dashboard                   │
│   - Visualization               │
└──────────┬──────────────────────┘
           │ REST API
           ▼
┌─────────────────────────────────┐
│   Backend (FastAPI)             │
│   - Document Parsing            │
│   - Embedding Generation        │
│   - Rule Extraction             │
│   - Analysis Orchestration      │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│   Actian VectorAI DB            │
│   - Vector Storage              │
│   - Semantic Search             │
│   - HNSW Indexing               │
└─────────────────────────────────┘
```

## Data Pipeline

### 1. Ingestion Pipeline

```
Document Upload
    ↓
Parse Paragraphs (python-docx)
    ↓
Semantic Chunking
    ↓
Generate Embeddings (sentence-transformers)
    ↓
Batch Upsert to VectorAI DB
    ↓
Rule Extraction (LLM or keyword-based)
    ↓
Store Rules in VectorAI DB
```

### 2. Analysis Pipeline

```
Retrieve All Rules (scroll)
    ↓
For Each Rule:
    ├─→ Semantic Search for Similar Rules
    │       ↓
    │   LLM Contradiction Check
    │       ↓
    │   Generate Inconsistency Report
    │
    ├─→ Group by System Type
    │       ↓
    │   Cross-System Analysis
    │       ↓
    │   Generate Loopholes
    │
    └─→ Extract Character Mentions
            ↓
        Track Trait Consistency
            ↓
        Build Character Profiles
```

## Vector Database Schema

### Collections

#### `world_{id}_chunks`
Raw manuscript paragraphs
- **id**: int (MD5 hash)
- **vector**: float[384] (COSINE distance)
- **text**: string (paragraph text)
- **chunk_idx**: int
- **chapter**: int (optional)
- **has_rule**: bool

#### `world_{id}_rules`
Extracted world-building rules
- **id**: int
- **vector**: float[384]
- **text**: string (rule statement)
- **system**: enum (magic|politics|tech|economy|culture|other)
- **chapter**: int (optional)
- **page**: int (optional)
- **confidence**: float (0-1)

#### `world_{id}_characters`
Character traits and mentions
- **id**: int
- **vector**: float[384]
- **character_name**: string
- **trait_type**: enum (moral|ability|relationship|motivation)
- **description**: string
- **first_seen_chapter**: int
- **last_seen_chapter**: int

#### `world_{id}_settings`
Locations and settings
- **id**: int
- **vector**: float[384]
- **location_name**: string
- **description**: string
- **governing_system**: string
- **associated_rules**: int[] (rule IDs)

## Embedding Strategy

### Model: sentence-transformers/all-MiniLM-L6-v2
- **Dimensions**: 384
- **Speed**: ~3000 sentences/sec on CPU
- **Quality**: Good semantic understanding for english text
- **License**: Apache 2.0

### Why This Model?
1. Fast inference without GPU
2. Good balance of speed vs quality
3. Works offline (no API costs)
4. Sufficient dimensions for semantic similarity

### Distance Metric: COSINE
- Normalized similarity (0-1 range)
- Better for semantic text comparison
- Threshold: 0.65 for similarity matches

## Inconsistency Detection Algorithm

```python
for rule_a in all_rules:
    similar_rules = semantic_search(rule_a.vector, top_k=5)
    
    for rule_b in similar_rules:
        if similarity > 0.65:
            is_contradiction = llm_check(rule_a, rule_b)
            
            if is_contradiction:
                severity = calculate_severity(similarity)
                report_inconsistency(rule_a, rule_b, severity)
```

### Severity Levels
- **HIGH**: similarity > 0.85 (very similar but contradictory)
- **MEDIUM**: similarity > 0.75
- **LOW**: similarity > 0.65

## Loophole Generation Algorithm

```python
rules_by_system = group_rules_by_system()

for system_a, system_b in cross_product(systems):
    rules_a = rules_by_system[system_a][:3]
    rules_b = rules_by_system[system_b][:3]
    
    loophole = llm_generate_loophole(rules_a, rules_b)
    
    if loophole.creativity_score > 0.5:
        yield loophole
```

## Knowledge Graph Construction

```python
rules = scroll_all_rules()
vectors = [r.vector for r in rules]

similarity_matrix = cosine_similarity(vectors, vectors)

edges = []
for i in range(len(rules)):
    for j in range(i+1, len(rules)):
        if similarity_matrix[i][j] > 0.65:
            edges.append({
                'from': rules[i].id,
                'to': rules[j].id,
                'weight': similarity_matrix[i][j]
            })

graph = build_vis_graph(rules, edges)
```

## API Endpoints

### Core Endpoints

- `POST /worlds` - Create new world
- `GET /worlds/{id}` - Get world details
- `POST /worlds/{id}/upload` - Upload manuscript
- `GET /worlds/{id}/inconsistencies` - Get inconsistency report
- `GET /worlds/{id}/loopholes` - Get loopholes
- `GET /worlds/{id}/characters` - Get character profiles
- `GET /worlds/{id}/graph` - Get knowledge graph data
- `POST /worlds/{id}/query` - Natural language query
- `WS /ws` - WebSocket for real-time updates

## Real-Time Updates

WebSocket messages:
```json
{
  "type": "ingestion_complete",
  "world_id": "uuid",
  "chunks_count": 123
}

{
  "type": "rules_extracted",
  "world_id": "uuid"
}

{
  "type": "inconsistencies_detected",
  "world_id": "uuid",
  "count": 5
}
```

## Performance Considerations

### Embedding Generation
- Batch embeddings (10-50 texts at once)
- CPU-optimized model
- ~100ms per batch

### Vector Search
- HNSW index for O(log n) search
- Top-k=5 is sufficient for most queries
- Filter DSL for metadata constraints

### Scalability
- Each world is isolated (separate collections)
- Horizontal scaling via FastAPI workers
- VectorAI DB handles millions of vectors

## LLM Integration

### With OpenAI API Key
- Model: gpt-4o-mini
- Temperature: 0.2-0.7 (task dependent)
- JSON mode for structured outputs
- Handles: rule extraction, contradiction detection, loophole generation

### Without API Key
- Keyword-based fallbacks
- Pattern matching for contradictions
- Template-based loophole suggestions
- Lower accuracy but functional

## Future Enhancements

1. **Multi-document support**: Track multiple manuscripts per world
2. **Timeline analysis**: Detect temporal inconsistencies
3. **Character arc tracking**: Visualize character development
4. **Export functionality**: Generate consistency reports
5. **Collaborative editing**: Multi-user world building
6. **Plugin system**: Custom rule validators

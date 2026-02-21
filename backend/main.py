from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
import uuid
import asyncio
from contextlib import asynccontextmanager

from services.ingestion import IngestionService
from services.vectorai import VectorAIService
from services.rule_extraction import RuleExtractionService
from services.inconsistency import InconsistencyDetectionService
from services.loophole import LoopholeGeneratorService
from services.character import CharacterTrackerService
from models.schemas import (
    World,
    InconsistencyReport,
    LoopholeReport,
    CharacterProfile,
    GraphData
)

services = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    services['vectorai'] = VectorAIService()
    services['ingestion'] = IngestionService(services['vectorai'])
    services['rule_extraction'] = RuleExtractionService(services['vectorai'])
    services['inconsistency'] = InconsistencyDetectionService(services['vectorai'])
    services['loophole'] = LoopholeGeneratorService(services['vectorai'])
    services['character'] = CharacterTrackerService(services['vectorai'])
    
    await services['vectorai'].connect()
    
    yield
    
    await services['vectorai'].disconnect()

app = FastAPI(
    title="Pure Imagination API",
    description="AI-powered world-building assistant for authors",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class WorldCreate(BaseModel):
    name: str
    description: Optional[str] = None

class QueryRequest(BaseModel):
    world_id: str
    query: str

connected_clients: List[WebSocket] = []

@app.get("/")
async def root():
    return {"message": "Pure Imagination API", "status": "running"}

@app.post("/worlds", response_model=World)
async def create_world(world: WorldCreate):
    world_id = str(uuid.uuid4())
    
    await services['vectorai'].create_world_collections(world_id)
    
    return World(
        id=world_id,
        name=world.name,
        description=world.description,
        created_at=None,
        rule_count=0,
        character_count=0
    )

@app.get("/worlds/{world_id}", response_model=World)
async def get_world(world_id: str):
    stats = await services['vectorai'].get_world_stats(world_id)
    
    return World(
        id=world_id,
        name=f"World {world_id[:8]}",
        description=None,
        created_at=None,
        rule_count=stats.get('rules', 0),
        character_count=stats.get('characters', 0)
    )

@app.post("/worlds/{world_id}/upload")
async def upload_manuscript(world_id: str, file: UploadFile = File(...)):
    if not file.filename.endswith(('.docx', '.txt')):
        raise HTTPException(status_code=400, detail="Only .docx and .txt files are supported")
    
    upload_dir = "/uploads"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, f"{world_id}_{file.filename}")
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    asyncio.create_task(process_manuscript(world_id, file_path))
    
    return {"message": "Upload successful, processing started", "world_id": world_id}

async def process_manuscript(world_id: str, file_path: str):
    try:
        chunks_count = await services['ingestion'].ingest_manuscript(world_id, file_path)
        
        await broadcast_update({
            "type": "ingestion_complete",
            "world_id": world_id,
            "chunks_count": chunks_count
        })
        
        await services['rule_extraction'].extract_rules(world_id)
        
        await broadcast_update({
            "type": "rules_extracted",
            "world_id": world_id
        })
        
        inconsistencies = await services['inconsistency'].detect_inconsistencies(world_id)
        
        await broadcast_update({
            "type": "inconsistencies_detected",
            "world_id": world_id,
            "count": len(inconsistencies)
        })
        
    except Exception as e:
        await broadcast_update({
            "type": "error",
            "world_id": world_id,
            "message": str(e)
        })

@app.get("/worlds/{world_id}/inconsistencies", response_model=List[InconsistencyReport])
async def get_inconsistencies(world_id: str):
    inconsistencies = await services['inconsistency'].detect_inconsistencies(world_id)
    return inconsistencies

@app.get("/worlds/{world_id}/loopholes", response_model=List[LoopholeReport])
async def get_loopholes(world_id: str):
    loopholes = await services['loophole'].generate_loopholes(world_id)
    return loopholes

@app.get("/worlds/{world_id}/characters", response_model=List[CharacterProfile])
async def get_characters(world_id: str):
    characters = await services['character'].get_all_characters(world_id)
    return characters

@app.get("/worlds/{world_id}/graph", response_model=GraphData)
async def get_world_graph(world_id: str):
    graph_data = await services['vectorai'].build_knowledge_graph(world_id)
    return graph_data

@app.post("/worlds/{world_id}/query")
async def query_world(request: QueryRequest):
    results = await services['vectorai'].semantic_search(
        world_id=request.world_id,
        query=request.query,
        top_k=5
    )
    
    return {"results": results}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            
    except WebSocketDisconnect:
        connected_clients.remove(websocket)

async def broadcast_update(message: dict):
    for client in connected_clients:
        try:
            await client.send_json(message)
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

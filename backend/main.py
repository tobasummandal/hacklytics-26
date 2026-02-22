from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
from ingest import ingest
from check import consistency_check
from graph import get_graph
from who import who_is_present


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_sqlite()
    await db.init_vectorai()
    yield
    await db.close_vectorai()


app = FastAPI(title="Story Consistency API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class IngestRequest(BaseModel):
    text: str
    chapter: int


class CheckRequest(BaseModel):
    text: str
    characters_present: list[str]
    chapter: int

class WhoRequest(BaseModel):
    text: str


@app.post("/who")
async def who_endpoint(req: WhoRequest):
    present = await who_is_present(req.text)
    return {"present": present}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/ingest")
async def ingest_endpoint(req: IngestRequest):
    return await ingest(req.text, req.chapter)


@app.post("/check")
async def check_endpoint(req: CheckRequest):
    return await consistency_check(req.text, req.characters_present, req.chapter)


@app.get("/graph")
async def full_graph_endpoint():
    async with db.get_db() as conn:
        entities = await (await conn.execute(
            "SELECT id, type, name FROM entities"
        )).fetchall()
        relationships = await (await conn.execute(
            "SELECT from_id, to_id, type, description FROM relationships"
        )).fetchall()

    type_colors = {
        "character": "#ec4899",
        "location": "#2563eb",
        "faction": "#9333ea",
        "event": "#f59e0b",
        "concept": "#6b7280",
        "object": "#b45309",
        "creature": "#16a34a",
    }

    nodes = [
        {
            "id": str(e["id"]),
            "label": e["name"],
            "type": e["type"],
            "color": type_colors.get(e["type"], "#6b7280"),
            "size": 20 if e["type"] == "character" else 12,
        }
        for e in entities
    ]
    edges = [
        {
            "from_node": str(r["from_id"]),
            "to_node": str(r["to_id"]),
            "label": r["type"],
            "weight": 1.0,
        }
        for r in relationships
    ]
    return {"nodes": nodes, "edges": edges}


@app.get("/graph/{character_name}")
async def graph_endpoint(character_name: str):
    data = await get_graph(character_name)
    if data is None:
        raise HTTPException(404, f"'{character_name}' not found")
    return data


@app.delete("/reset", status_code=204)
async def reset():
    async with db.get_db() as conn:
        for table in ("embedding_chunks", "attributes", "relationships", "entities"):
            await conn.execute(f"DELETE FROM {table}")
        await conn.commit()
    # also clear VectorAI collection
    await db.vectorai.delete_collection(db.COLLECTION)
    await db.vectorai.create_collection(
        name=db.COLLECTION, dimension=3072, distance_metric=db.DistanceMetric.COSINE
    )

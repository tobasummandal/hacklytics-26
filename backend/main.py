from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
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
        name=db.COLLECTION, dimension=1536, distance_metric=db.DistanceMetric.COSINE
    )

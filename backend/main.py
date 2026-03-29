from contextlib import asynccontextmanager
import asyncio
import os
import re
import time
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai.errors import ClientError
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


INGEST_JOBS: dict[str, dict[str, Any]] = {}
INGEST_JOBS_LOCK = asyncio.Lock()
INGEST_JOB_TTL_SECONDS = 60 * 60


def _now_ts() -> float:
    return time.time()


async def _set_ingest_job(ingest_job_id: str, **updates: Any) -> None:
    async with INGEST_JOBS_LOCK:
        existing = INGEST_JOBS.get(ingest_job_id, {})
        existing.update(updates)
        existing["updated_at"] = _now_ts()
        INGEST_JOBS[ingest_job_id] = existing
        cutoff = _now_ts() - INGEST_JOB_TTL_SECONDS
        old_ids = [jid for jid, j in INGEST_JOBS.items() if j.get("updated_at", 0) < cutoff]
        for jid in old_ids:
            del INGEST_JOBS[jid]


def _gemini_error_payload(err: ClientError) -> tuple[int, dict]:
    msg = str(err)
    status_code = getattr(err, "status_code", None)
    lower = msg.lower()

    if status_code == 429 or "resource_exhausted" in lower or "quota exceeded" in lower:
        retry_after = None
        m = re.search(r"retry in ([0-9]+(?:\.[0-9]+)?)s", lower)
        if m:
            retry_after = float(m.group(1))
        return 429, {
            "code": "gemini_quota_exceeded",
            "message": "Gemini quota exceeded. Wait and retry, or use a key/project with higher quota.",
            "retry_after_seconds": retry_after,
        }

    if status_code in (401, 403) or "api key" in lower or "permission" in lower:
        return 401, {
            "code": "gemini_auth_error",
            "message": "Gemini API key is invalid or unauthorized for this project/model.",
        }

    return 502, {
        "code": "gemini_request_failed",
        "message": "Gemini request failed. Check API key, quota, and model access.",
    }


def _gemini_http_exception(err: ClientError) -> HTTPException:
    status_code, detail = _gemini_error_payload(err)
    return HTTPException(status_code=status_code, detail=detail)


async def _gemini_health(probe_gemini: bool) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    status = {
        "key_configured": bool(api_key),
        "generation_check": "skipped",
        "retry_after_seconds": None,
    }

    if not api_key:
        status["generation_check"] = "missing_key"
        return status

    if not probe_gemini:
        return status

    client = genai.Client(api_key=api_key)
    try:
        await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents="ping",
        )
        status["generation_check"] = "ok"
        return status
    except ClientError as e:
        msg = str(e)
        lower = msg.lower()
        code = getattr(e, "status_code", None)
        m = re.search(r"retry in ([0-9]+(?:\.[0-9]+)?)s", lower)
        if m:
            status["retry_after_seconds"] = float(m.group(1))
        if code == 429 or "resource_exhausted" in lower or "quota exceeded" in lower:
            status["generation_check"] = "quota_exceeded"
        elif code in (401, 403) or "api key" in lower or "permission" in lower:
            status["generation_check"] = "auth_error"
        else:
            status["generation_check"] = "error"
        return status


@app.post("/who")
async def who_endpoint(req: WhoRequest):
    try:
        present = await who_is_present(req.text)
        return {"present": present}
    except ClientError as e:
        raise _gemini_http_exception(e) from e


@app.get("/health")
async def health(probe_gemini: bool = False):
    return {
        "status": "ok",
        "vectorai": {
            "connected": db.vectorai_ready(),
        },
        "gemini": await _gemini_health(probe_gemini),
    }


async def _run_ingest_job(job_id: str, text: str, chapter: int) -> None:
    await _set_ingest_job(job_id, status="running")

    async def progress_cb(payload: dict) -> None:
        await _set_ingest_job(job_id, status="running", progress=payload)

    try:
        result = await ingest(text, chapter, progress_cb=progress_cb)
        await _set_ingest_job(
            job_id,
            status="completed",
            result=result,
            progress={
                "percent": 100,
                "phase": "completed",
                "message": "Ingestion complete",
                "totals": result,
            },
            completed_at=_now_ts(),
        )
    except ClientError as e:
        status_code, detail = _gemini_error_payload(e)
        await _set_ingest_job(
            job_id,
            status="failed",
            error=detail,
            error_status=status_code,
            completed_at=_now_ts(),
        )
    except Exception as e:
        await _set_ingest_job(
            job_id,
            status="failed",
            error={"code": "ingest_failed", "message": str(e)},
            error_status=500,
            completed_at=_now_ts(),
        )


@app.post("/ingest", status_code=202)
async def ingest_endpoint(req: IngestRequest):
    job_id = str(uuid.uuid4())
    await _set_ingest_job(
        job_id,
        job_id=job_id,
        status="queued",
        created_at=_now_ts(),
        progress={
            "percent": 0,
            "phase": "queued",
            "message": "Queued for ingestion",
            "totals": {"entities": 0, "attributes": 0, "relationships": 0, "embedding_chunks": 0},
        },
    )
    asyncio.create_task(_run_ingest_job(job_id, req.text, req.chapter))
    return {"job_id": job_id, "status": "queued"}


@app.get("/ingest/{job_id}")
async def ingest_status(job_id: str):
    async with INGEST_JOBS_LOCK:
        job = INGEST_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"code": "job_not_found", "message": "Ingest job not found"})
    return job


@app.post("/check")
async def check_endpoint(req: CheckRequest):
    try:
        return await consistency_check(req.text, req.characters_present, req.chapter)
    except ClientError as e:
        raise _gemini_http_exception(e) from e


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

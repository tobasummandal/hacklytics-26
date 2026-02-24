from contextlib import asynccontextmanager
import asyncio
import json
import hashlib
import os
import re
import time
import uuid
from typing import Any
from collections import defaultdict, deque

from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google import genai
from google.genai.errors import ClientError
from pydantic import BaseModel

import db
from ingest import ingest
from check import consistency_check
from graph import get_graph
from who import who_is_present, clear_known_character_cache


@asynccontextmanager
async def lifespan(app: FastAPI):
    global INGEST_WORKER_TASK
    await db.init_sqlite()
    await db.init_vectorai()
    await _rehydrate_ingest_jobs()
    INGEST_WORKER_TASK = asyncio.create_task(_ingest_worker())
    yield
    if INGEST_WORKER_TASK:
        INGEST_WORKER_TASK.cancel()
        try:
            await INGEST_WORKER_TASK
        except asyncio.CancelledError:
            pass
        INGEST_WORKER_TASK = None
    await db.close_vectorai()


app = FastAPI(title="Story Consistency API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    metric_key = f"{request.method} {request.url.path}"
    async with REQUEST_METRICS_LOCK:
        REQUEST_METRICS[metric_key].append(duration_ms)
    response.headers["X-Response-Time-ms"] = f"{duration_ms:.2f}"
    if not request.url.path.startswith("/health"):
        print(
            f"[http] method={request.method} path={request.url.path} "
            f"status={response.status_code} duration_ms={duration_ms:.2f}"
        )
    return response


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    arr = sorted(values)
    idx = int(round((len(arr) - 1) * p))
    idx = max(0, min(len(arr) - 1, idx))
    return arr[idx]


class IngestRequest(BaseModel):
    text: str
    chapter: int


class CheckRequest(BaseModel):
    text: str
    characters_present: list[str]
    chapter: int


class CheckPassageRequest(BaseModel):
    text: str
    chapter: int


class WhoRequest(BaseModel):
    text: str


INGEST_JOBS: dict[str, dict[str, Any]] = {}
INGEST_JOBS_LOCK = asyncio.Lock()
INGEST_JOB_TTL_SECONDS = 60 * 60
INGEST_QUEUE: asyncio.Queue[tuple[str, str, int]] = asyncio.Queue()
INGEST_QUEUE_LOCK = asyncio.Lock()
INGEST_ENQUEUED: set[str] = set()
INGEST_WORKER_TASK: asyncio.Task | None = None
CHECK_CACHE: dict[str, dict[str, Any]] = {}
CHECK_CACHE_LOCK = asyncio.Lock()
CHECK_CACHE_TTL_SECONDS = 20
REQUEST_METRICS: dict[str, deque[float]] = defaultdict(lambda: deque(maxlen=300))
REQUEST_METRICS_LOCK = asyncio.Lock()


def _now_ts() -> float:
    return time.time()


async def _set_ingest_job(ingest_job_id: str, **updates: Any) -> None:
    payload: dict[str, Any] | None = None
    async with INGEST_JOBS_LOCK:
        existing = INGEST_JOBS.get(ingest_job_id, {})
        existing.update(updates)
        existing["updated_at"] = _now_ts()
        INGEST_JOBS[ingest_job_id] = existing
        payload = dict(existing)
        cutoff = _now_ts() - INGEST_JOB_TTL_SECONDS
        old_ids = [jid for jid, j in INGEST_JOBS.items() if j.get("updated_at", 0) < cutoff]
        for jid in old_ids:
            del INGEST_JOBS[jid]

    if payload is None:
        return

    async with db.get_db() as conn:
        await conn.execute(
            """INSERT INTO ingest_jobs (job_id, payload, updated_at)
               VALUES (?, ?, ?)
               ON CONFLICT(job_id) DO UPDATE SET
                 payload=excluded.payload,
                 updated_at=excluded.updated_at""",
            (ingest_job_id, json.dumps(payload), float(payload.get("updated_at", _now_ts()))),
        )
        cutoff = _now_ts() - INGEST_JOB_TTL_SECONDS
        await conn.execute("DELETE FROM ingest_jobs WHERE updated_at < ?", (cutoff,))
        await conn.commit()


async def _get_ingest_job(job_id: str) -> dict[str, Any] | None:
    async with INGEST_JOBS_LOCK:
        job = INGEST_JOBS.get(job_id)
        if not job:
            pass
        else:
            return dict(job)

    async with db.get_db() as conn:
        row = await (await conn.execute(
            "SELECT payload FROM ingest_jobs WHERE job_id = ?",
            (job_id,),
        )).fetchone()
    if not row:
        return None
    try:
        payload = json.loads(row["payload"])
    except Exception:
        return None
    async with INGEST_JOBS_LOCK:
        INGEST_JOBS[job_id] = payload
    return payload


def _public_ingest_job(job: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in job.items() if not k.startswith("_")}


async def _mark_ingest_dequeued(job_id: str) -> None:
    async with INGEST_QUEUE_LOCK:
        INGEST_ENQUEUED.discard(job_id)


async def _enqueue_ingest_job(job_id: str, text: str, chapter: int) -> None:
    async with INGEST_QUEUE_LOCK:
        if job_id in INGEST_ENQUEUED:
            return
        INGEST_ENQUEUED.add(job_id)
    await INGEST_QUEUE.put((job_id, text, chapter))


async def _rehydrate_ingest_jobs() -> None:
    async with db.get_db() as conn:
        rows = await (await conn.execute(
            "SELECT payload FROM ingest_jobs ORDER BY updated_at ASC"
        )).fetchall()
    for r in rows:
        try:
            payload = json.loads(r["payload"])
        except Exception:
            continue
        status = payload.get("status")
        job_id = payload.get("job_id")
        text = payload.get("_text")
        chapter = payload.get("chapter")
        if (
            isinstance(job_id, str)
            and isinstance(text, str)
            and isinstance(chapter, int)
            and status in ("queued", "running")
        ):
            await _enqueue_ingest_job(job_id, text, chapter)


async def _ingest_worker() -> None:
    while True:
        job_id, text, chapter = await INGEST_QUEUE.get()
        try:
            await _run_ingest_job(job_id, text, chapter)
        except Exception as e:
            print(f"[ingest-worker] job={job_id} crashed: {type(e).__name__}: {e}")
            await _set_ingest_job(
                job_id,
                status="failed",
                error={"code": "worker_crash", "message": str(e)},
                error_status=500,
                completed_at=_now_ts(),
            )
        finally:
            await _mark_ingest_dequeued(job_id)
            INGEST_QUEUE.task_done()


async def _clear_ingest_queue() -> None:
    async with INGEST_QUEUE_LOCK:
        INGEST_ENQUEUED.clear()
    while True:
        try:
            INGEST_QUEUE.get_nowait()
            INGEST_QUEUE.task_done()
        except asyncio.QueueEmpty:
            break


def _check_cache_key(text: str, chapter: int) -> str:
    return hashlib.sha256(f"{chapter}::{text.strip()}".encode("utf-8")).hexdigest()


async def _get_check_cache(key: str) -> dict[str, Any] | None:
    now = _now_ts()
    async with CHECK_CACHE_LOCK:
        entry = CHECK_CACHE.get(key)
        if not entry:
            return None
        if float(entry.get("expires_at", 0)) < now:
            del CHECK_CACHE[key]
            return None
        return entry.get("value")


async def _set_check_cache(key: str, value: dict[str, Any]) -> None:
    now = _now_ts()
    async with CHECK_CACHE_LOCK:
        CHECK_CACHE[key] = {
            "value": value,
            "expires_at": now + CHECK_CACHE_TTL_SECONDS,
            "updated_at": now,
        }
        cutoff = now - (CHECK_CACHE_TTL_SECONDS * 3)
        old_keys = [k for k, v in CHECK_CACHE.items() if float(v.get("updated_at", 0)) < cutoff]
        for k in old_keys:
            del CHECK_CACHE[k]


async def _clear_check_cache() -> None:
    async with CHECK_CACHE_LOCK:
        CHECK_CACHE.clear()


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


@app.get("/metrics")
async def metrics():
    async with REQUEST_METRICS_LOCK:
        snap = {k: list(v) for k, v in REQUEST_METRICS.items()}
    out: dict[str, dict[str, float | int]] = {}
    for key, vals in snap.items():
        if not vals:
            continue
        out[key] = {
            "count": len(vals),
            "p50_ms": round(_percentile(vals, 0.50), 2),
            "p95_ms": round(_percentile(vals, 0.95), 2),
            "max_ms": round(max(vals), 2),
        }
    return {"window_size": 300, "routes": out}


async def _run_ingest_job(job_id: str, text: str, chapter: int) -> None:
    await _set_ingest_job(job_id, status="running")

    async def progress_cb(payload: dict) -> None:
        await _set_ingest_job(job_id, status="running", progress=payload)

    try:
        result = await ingest(text, chapter, progress_cb=progress_cb)
        clear_known_character_cache()
        await _clear_check_cache()
        await _set_ingest_job(
            job_id,
            status="completed",
            _text=None,
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
            _text=None,
            error=detail,
            error_status=status_code,
            completed_at=_now_ts(),
        )
    except Exception as e:
        await _set_ingest_job(
            job_id,
            status="failed",
            _text=None,
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
        chapter=req.chapter,
        _text=req.text,
        status="queued",
        created_at=_now_ts(),
        progress={
            "percent": 0,
            "phase": "queued",
            "message": "Queued for ingestion",
            "totals": {"entities": 0, "attributes": 0, "relationships": 0, "embedding_chunks": 0},
        },
    )
    await _enqueue_ingest_job(job_id, req.text, req.chapter)
    return {"job_id": job_id, "status": "queued"}


@app.get("/ingest/{job_id}")
async def ingest_status(job_id: str):
    job = await _get_ingest_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"code": "job_not_found", "message": "Ingest job not found"})
    return _public_ingest_job(job)


@app.get("/ingest/{job_id}/events")
async def ingest_events(job_id: str):
    initial = await _get_ingest_job(job_id)
    if not initial:
        raise HTTPException(status_code=404, detail={"code": "job_not_found", "message": "Ingest job not found"})

    async def event_generator():
        last_updated = -1.0
        heartbeat_counter = 0
        while True:
            job = await _get_ingest_job(job_id)
            if not job:
                yield "event: error\ndata: {\"message\":\"job_not_found\"}\n\n"
                break

            updated_at = float(job.get("updated_at", 0))
            if updated_at > last_updated:
                last_updated = updated_at
                yield f"event: progress\ndata: {json.dumps(_public_ingest_job(job))}\n\n"

            status = job.get("status")
            if status in ("completed", "failed"):
                yield "event: done\ndata: {}\n\n"
                break

            heartbeat_counter += 1
            if heartbeat_counter >= 30:
                heartbeat_counter = 0
                yield "event: ping\ndata: {}\n\n"

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@app.post("/check")
async def check_endpoint(req: CheckRequest):
    try:
        return await consistency_check(req.text, req.characters_present, req.chapter)
    except ClientError as e:
        raise _gemini_http_exception(e) from e


@app.post("/check-passage")
async def check_passage_endpoint(req: CheckPassageRequest):
    try:
        cache_key = _check_cache_key(req.text, req.chapter)
        cached = await _get_check_cache(cache_key)
        if cached is not None:
            return cached

        present = await who_is_present(req.text)
        if not present:
            payload = {"present": [], "flags": []}
            await _set_check_cache(cache_key, payload)
            return payload
        result = await consistency_check(req.text, present, req.chapter)
        payload = {"present": present, "flags": result.get("flags", [])}
        await _set_check_cache(cache_key, payload)
        return payload
    except ClientError as e:
        raise _gemini_http_exception(e) from e


@app.get("/graph")
async def full_graph_endpoint(
    types: str | None = Query(default=None, description="Comma-separated entity types to include"),
    q: str | None = Query(default=None, description="Case-insensitive node label search"),
    limit_nodes: int = Query(default=500, ge=1, le=5000),
    limit_edges: int = Query(default=2000, ge=1, le=20000),
):
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

    filtered_entities = entities
    if types:
        allowed = {t.strip() for t in types.split(",") if t.strip()}
        if allowed:
            filtered_entities = [e for e in filtered_entities if e["type"] in allowed]
    if q:
        needle = q.strip().lower()
        if needle:
            filtered_entities = [e for e in filtered_entities if needle in e["name"].lower()]

    filtered_entities = filtered_entities[:limit_nodes]
    visible_ids = {e["id"] for e in filtered_entities}

    filtered_relationships = [
        r for r in relationships
        if r["from_id"] in visible_ids and r["to_id"] in visible_ids
    ][:limit_edges]

    nodes = [
        {
            "id": str(e["id"]),
            "label": e["name"],
            "type": e["type"],
            "color": type_colors.get(e["type"], "#6b7280"),
            "size": 20 if e["type"] == "character" else 12,
        }
        for e in filtered_entities
    ]
    edges = [
        {
            "from_node": str(r["from_id"]),
            "to_node": str(r["to_id"]),
            "label": r["type"],
            "weight": 1.0,
        }
        for r in filtered_relationships
    ]
    return {
        "nodes": nodes,
        "edges": edges,
        "meta": {
            "total_nodes": len(entities),
            "total_edges": len(relationships),
            "returned_nodes": len(nodes),
            "returned_edges": len(edges),
        },
    }


@app.get("/graph/cytoscape")
async def graph_cytoscape_endpoint(
    types: str | None = Query(default=None, description="Comma-separated entity types to include"),
    q: str | None = Query(default=None, description="Case-insensitive node label search"),
    limit_nodes: int = Query(default=500, ge=1, le=5000),
    limit_edges: int = Query(default=2000, ge=1, le=20000),
):
    graph = await full_graph_endpoint(
        types=types,
        q=q,
        limit_nodes=limit_nodes,
        limit_edges=limit_edges,
    )
    elements = []
    for n in graph["nodes"]:
        elements.append({
            "data": {
                "id": n["id"],
                "label": n["label"],
                "type": n["type"],
                "color": n["color"],
                "size": n["size"],
            }
        })
    for e in graph["edges"]:
        elements.append({
            "data": {
                "id": f"{e['from_node']}->{e['to_node']}:{e['label']}",
                "source": e["from_node"],
                "target": e["to_node"],
                "label": e["label"],
                "weight": e.get("weight", 1.0),
            }
        })
    return {"elements": elements, "meta": graph.get("meta", {})}


@app.get("/graph/{character_name}")
async def graph_endpoint(character_name: str):
    data = await get_graph(character_name)
    if data is None:
        raise HTTPException(404, f"'{character_name}' not found")
    return data


@app.delete("/reset", status_code=204)
async def reset():
    await _clear_ingest_queue()
    async with INGEST_JOBS_LOCK:
        INGEST_JOBS.clear()
    async with db.get_db() as conn:
        for table in ("embedding_chunks", "attributes", "relationships", "entities"):
            await conn.execute(f"DELETE FROM {table}")
        await conn.execute("DELETE FROM ingest_jobs")
        await conn.commit()
    # also clear VectorAI collection
    await db.vectorai.delete_collection(db.COLLECTION)
    await db.vectorai.create_collection(
        name=db.COLLECTION, dimension=3072, distance_metric=db.DistanceMetric.COSINE
    )
    clear_known_character_cache()
    await _clear_check_cache()

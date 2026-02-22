"""
Storage layer:
  - SQLite  → entities, attributes, relationships, embedding_chunks metadata
  - VectorAI → embedding_chunks vectors (id matches SQLite rowid)
"""
import os
from contextlib import asynccontextmanager

import aiosqlite
from cortex import AsyncCortexClient, DistanceMetric
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

DB_PATH = os.path.join(os.path.dirname(__file__), "story.db")
COLLECTION = "embedding_chunks"

vectorai: AsyncCortexClient | None = None


# ── SQLite ───────────────────────────────────────────────────────────────────

_SCHEMA = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS entities (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    type               TEXT NOT NULL,
    name               TEXT NOT NULL UNIQUE,
    chapter_introduced INTEGER
);

CREATE TABLE IF NOT EXISTS attributes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL REFERENCES entities(id),
    type      TEXT NOT NULL,
    value     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS relationships (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id     INTEGER NOT NULL REFERENCES entities(id),
    to_id       INTEGER NOT NULL REFERENCES entities(id),
    type        TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS embedding_chunks (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id          INTEGER NOT NULL REFERENCES entities(id),
    chapter            INTEGER,
    scene_type         TEXT,
    behavioral_summary TEXT NOT NULL,
    source_text        TEXT
);
"""


@asynccontextmanager
async def get_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db


async def init_sqlite() -> None:
    async with get_db() as db:
        await db.executescript(_SCHEMA)
        await db.commit()


# ── VectorAI ─────────────────────────────────────────────────────────────────

async def init_vectorai() -> None:
    global vectorai
    host = os.getenv("VECTORAI_HOST", "localhost")
    port = os.getenv("VECTORAI_PORT", "50051")
    vectorai = AsyncCortexClient(f"{host}:{port}")
    await vectorai.__aenter__()

    if not await vectorai.has_collection(COLLECTION):
        await vectorai.create_collection(
            name=COLLECTION,
            dimension=3072,
            distance_metric=DistanceMetric.COSINE,
        )


async def close_vectorai() -> None:
    if vectorai:
        await vectorai.__aexit__(None, None, None)


def vectorai_ready() -> bool:
    return vectorai is not None

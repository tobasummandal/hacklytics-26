import json
import os
import re
import uuid

from google import genai
from google.genai import types

import db

gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

EXTRACTION_PROMPT = """
You are a story analysis AI. Analyze this passage and return ONLY valid JSON 
with no markdown, no explanation, no trailing commas.

{
  "entities": [
    {
      "type": "character|location|event|object|faction|creature|concept",
      "name": "EntityName",
      "attributes": [
        {
          "type": "trait|belief|fear|desire|flaw|appearance|speech_pattern|habit|skill|weakness|secret|motivation|occupation|social_status|origin|atmosphere|outcome|power|goal",
          "value": "a concise phrase or sentence describing this attribute"
        }
      ]
    }
  ],
  "relationships": [
    {
      "from": "EntityName",
      "to": "EntityName",
      "type": "loves|hates|distrusts|fears|respects|betrayed|member_of|leads|owns|caused|witnessed|located_in|controls|enemy_of|ally_of",
      "description": "only include if the relationship has specific nuance beyond the type label — e.g. 'distrusts because of past betrayal' or 'loves but keeps it secret'. Leave as null if the type label is self-explanatory."
    }
  ],
  "embedding_chunks": [
    {
      "primary_character": "CharacterName",
      "scene_type": "confrontation|dialogue|internal|action|emotional",
      "behavioral_summary": "A natural paragraph describing what this character reveals about themselves in this moment. Write it to capture their emotional state, how they respond to the situation, what they prioritize, and how they communicate. Do not follow a fixed template — write what is most revealing about this character in this specific moment."
    }
  ]
}

--- RULES FOR ENTITIES ---

- Only extract entities that are explicitly present or clearly referenced in the passage
- Do not infer or invent entities not mentioned in the text
- Use the character's most commonly used name — do not create duplicate entries for nicknames
- For attributes, value should be a concise, specific phrase — not a single word and not a full paragraph
  Good: "speaks in short clipped sentences when angry"
  Bad: "angry" or "Sarah tends to speak in a very particular way when she is feeling emotions"
- Only extract attributes that are clearly revealed in this passage — do not infer backstory
- A character can have zero attributes if nothing meaningful is revealed about them in this passage

--- RULES FOR RELATIONSHIPS ---

- Only extract relationships that are explicitly shown or stated in this passage
- Do not infer relationships from implication alone
- Both entities in a relationship must already exist in the entities list
- description is optional — only add it when the relationship has specific context 
  that the type label alone does not capture
- Do not create duplicate relationships — if the same relationship appears 
  multiple times in a passage, extract it once

--- RULES FOR EMBEDDING CHUNKS ---

- Only create a chunk if the character does something that reveals personality, 
  emotion under pressure, a decision, a belief, or a relationship dynamic
- Skip: appearance descriptions, world building, setting, 
  routine actions with no emotional content, passing mentions
- Write the behavioral_summary as a natural paragraph — 
  do not follow a rigid template, let the content of the moment guide the writing
- One chunk per meaningful character moment
- If nothing meaningful is revealed about a character in this passage, omit them entirely

Passage to analyze:
{passage}"""


def chunk_text(text: str, max_words: int = 350) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks, current, count = [], [], 0
    for para in paragraphs:
        words = len(para.split())
        if count + words > max_words and current:
            chunks.append("\n\n".join(current))
            current, count = [], 0
        current.append(para)
        count += words
    if current:
        chunks.append("\n\n".join(current))
    return chunks


async def _extract(passage: str) -> dict:
    resp = await gemini.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=EXTRACTION_PROMPT.format(passage=passage),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0,
        ),
    )
    return json.loads(resp.text)


async def _embed(texts: list[str]) -> list[list[float]]:
    resp = await gemini.aio.models.embed_content(
        model="models/gemini-embedding-001",
        contents=texts,
    )
    return [e.values for e in resp.embeddings]


async def _upsert_entity(db_conn, name: str, etype: str, chapter: int) -> int:
    row = await (await db_conn.execute("SELECT id FROM entities WHERE name = ?", (name,))).fetchone()
    if row:
        return row["id"]
    cur = await db_conn.execute(
        "INSERT INTO entities (type, name, chapter_introduced) VALUES (?, ?, ?)",
        (etype, name, chapter),
    )
    return cur.lastrowid


async def _upsert_attribute(db_conn, entity_id: int, atype: str, value: str) -> None:
    exists = await (await db_conn.execute(
        "SELECT 1 FROM attributes WHERE entity_id = ? AND type = ? AND value = ?",
        (entity_id, atype, value),
    )).fetchone()
    if not exists:
        await db_conn.execute(
            "INSERT INTO attributes (entity_id, type, value) VALUES (?, ?, ?)",
            (entity_id, atype, value),
        )


async def _upsert_relationship(db_conn, from_id: int, to_id: int, rtype: str, desc: str) -> None:
    exists = await (await db_conn.execute(
        "SELECT 1 FROM relationships WHERE from_id = ? AND to_id = ? AND type = ?",
        (from_id, to_id, rtype),
    )).fetchone()
    if not exists:
        await db_conn.execute(
            "INSERT INTO relationships (from_id, to_id, type, description) VALUES (?, ?, ?, ?)",
            (from_id, to_id, rtype, desc),
        )


async def ingest(text: str, chapter: int) -> dict:
    chunks = chunk_text(text)
    totals = {"entities": 0, "attributes": 0, "relationships": 0, "embedding_chunks": 0}

    for i, chunk in enumerate(chunks):
        print(f"[ingest] chunk {i+1}/{len(chunks)} ({len(chunk.split())} words)")
        extracted = await _extract(chunk)
        name_to_id: dict[str, int] = {}

        async with db.get_db() as conn:
            # entities + attributes
            for ent in extracted.get("entities", []):
                eid = await _upsert_entity(conn, ent["name"], ent["type"], chapter)
                is_new = ent["name"] not in name_to_id
                name_to_id[ent["name"]] = eid
                if is_new:
                    totals["entities"] += 1
                for attr in ent.get("attributes", []):
                    await _upsert_attribute(conn, eid, attr["type"], attr["value"])
                    totals["attributes"] += 1

            # relationships
            for rel in extracted.get("relationships", []):
                from_id = name_to_id.get(rel["from"])
                to_id = name_to_id.get(rel["to"])
                if from_id and to_id:
                    await _upsert_relationship(conn, from_id, to_id, rel["type"], rel.get("description", ""))
                    totals["relationships"] += 1

            # embedding chunks — insert metadata into SQLite first to get IDs
            ec_items = extracted.get("embedding_chunks", [])
            sqlite_ids, valid_items = [], []
            for ec in ec_items:
                char_id = name_to_id.get(ec["primary_character"])
                if not char_id:
                    continue
                cur = await conn.execute(
                    "INSERT INTO embedding_chunks (entity_id, chapter, scene_type, behavioral_summary, source_text) VALUES (?, ?, ?, ?, ?)",
                    (char_id, chapter, ec["scene_type"], ec["behavioral_summary"], chunk),
                )
                sqlite_ids.append(cur.lastrowid)
                valid_items.append((char_id, ec))

            await conn.commit()

        # generate embeddings and push to VectorAI
        if valid_items:
            summaries = [ec["behavioral_summary"] for _, ec in valid_items]
            vectors = await _embed(summaries)
            await db.vectorai.batch_upsert(
                db.COLLECTION,
                ids=sqlite_ids,
                vectors=vectors,
                payloads=[{"entity_id": char_id} for char_id, _ in valid_items],
            )
            await db.vectorai.flush(db.COLLECTION)
            totals["embedding_chunks"] += len(valid_items)

    print(
        f"[ingest] done — {totals['entities']} entities, "
        f"{totals['attributes']} attributes, "
        f"{totals['relationships']} relationships, "
        f"{totals['embedding_chunks']} embedding chunks"
    )
    return totals

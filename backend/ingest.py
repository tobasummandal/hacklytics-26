import json
import os
import re
from typing import Awaitable, Callable

from google import genai
from google.genai import types

import db

gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

EXTRACTION_PROMPT = """
You are a story analysis AI. Analyze the passage below and return ONLY valid JSON
with no markdown, no explanation, no trailing commas.

{prev_context}

{{
  "characters_present": ["CharacterName"],
  "entities": [
    {{
      "type": "character|location|event|object|faction|creature|concept",
      "name": "EntityName",
      "attributes": [
        {{
          "type": "trait|belief|fear|desire|flaw|appearance|speech_pattern|habit|skill|weakness|secret|motivation|occupation|social_status|origin|atmosphere|outcome|power|goal",
          "value": "a concise phrase or sentence describing this attribute"
        }}
      ]
    }}
  ],
  "relationships": [
    {{
      "from": "EntityName",
      "to": "EntityName",
      "type": "loves|hates|distrusts|fears|respects|betrayed|member_of|leads|owns|caused|witnessed|located_in|controls|enemy_of|ally_of|kills|protects|serves|opposes|mentors|rivals",
      "description": "only include if the relationship has specific nuance beyond the type label. Leave as null if the type label is self-explanatory."
    }}
  ],
  "embedding_chunks": [
    {{
      "primary_character": "CharacterName",
      "scene_type": "confrontation|dialogue|internal|action|emotional",
      "behavioral_summary": "A natural paragraph describing what this character reveals about themselves in this moment. Write it to capture their emotional state, how they respond to the situation, what they prioritize, and how they communicate. Do not follow a fixed template — write what is most revealing about this character in this specific moment."
    }}
  ]
}}

--- RULES FOR characters_present ---

- List every named character who appears or is meaningfully referenced in the CURRENT passage only
- Resolve pronouns using the preceding context if provided — output the actual name, never a pronoun
- If a pronoun cannot be resolved to a known name, omit that character entirely
- This list is ONLY for pronoun resolution of character names — it does NOT limit what goes into entities

--- RULES FOR ENTITIES ---

- Extract characters, and only extract other types (location, event, object, faction, creature, concept) if they are plot-significant — not merely mentioned in passing
- A location is worth extracting if it is a named place that matters to the scene (e.g. "Penny's classroom"), not generic settings like "the hallway" or "the table"
- An object is worth extracting only if it carries symbolic, emotional, or plot weight (e.g. a specific heirloom, a weapon, a letter) — not incidental props
- An event is worth extracting only if it is a named or recurring event characters explicitly reference (e.g. "the staff potluck"), not actions like "he walked in"
- A concept or faction is worth extracting only if it is named and meaningfully shapes the story
- When in doubt, do NOT extract — fewer precise entities beat many vague ones
- If the same thing is referred to by multiple names (e.g. "the Gate" and "Gate of Mourning"), extract it once using the most specific name
- Only extract from the CURRENT passage (not from preceding context)
- For character entities: use resolved names from characters_present — never use pronouns
- Use the most commonly used name — no duplicates for nicknames or slight variations
- For attributes, value should be a concise, specific phrase — not a single word and not a full paragraph
  Good: "speaks in short clipped sentences when angry"
  Bad: "angry" or "Sarah tends to speak in a very particular way when she is feeling emotions"
- Only extract attributes clearly revealed in this passage — do not infer backstory
- A character can have zero attributes if nothing meaningful is revealed in this passage

--- RULES FOR RELATIONSHIPS ---

- Only extract relationships explicitly shown or stated in the CURRENT passage
- Do not infer relationships from implication alone
- Both entities in a relationship must already exist in the entities list
- description is optional — only add it when the relationship has specific context the type label alone does not capture
- Do not create duplicate relationships

--- RULES FOR EMBEDDING CHUNKS ---

- Only create a chunk if the character does something that reveals personality,
  emotion under pressure, a decision, a belief, or a relationship dynamic
- Skip: appearance descriptions, world building, setting,
  routine actions with no emotional content, passing mentions
- Write the behavioral_summary as a natural paragraph
- One chunk per meaningful character moment
- Use resolved character names — never use pronouns as primary_character

Passage to analyze:
{passage}"""

PREV_CONTEXT_BLOCK = """\
--- PRECEDING CHARACTER CONTEXT ---
The following named characters were present in the passage immediately before this one: {prev_characters}.
Use this ONLY to resolve pronouns or ambiguous references in the current passage.
Do NOT extract entities or relationships from this context.
--- END PRECEDING CHARACTER CONTEXT ---
"""


def chunk_text(text: str, max_words: int = 150) -> list[str]:
    # split into paragraphs first, then sentences within oversized paragraphs
    paragraphs = [p.strip() for p in re.split(r"\n+", text) if p.strip()]

    sentences: list[str] = []
    for para in paragraphs:
        if len(para.split()) <= max_words:
            sentences.append(para)
        else:
            # split paragraph into sentences
            parts = re.split(r'(?<=[.!?])\s+', para)
            sentences.extend(p.strip() for p in parts if p.strip())

    chunks, current, count = [], [], 0
    for sent in sentences:
        words = len(sent.split())
        if count + words > max_words and current:
            chunks.append(" ".join(current))
            current, count = [], 0
        current.append(sent)
        count += words
    if current:
        chunks.append(" ".join(current))
    return chunks


async def _extract(passage: str, prev_characters: list[str] | None = None) -> dict:
    prev_context = PREV_CONTEXT_BLOCK.format(prev_characters=", ".join(prev_characters)) if prev_characters else ""
    prompt = EXTRACTION_PROMPT.format(passage=passage, prev_context=prev_context)
    print(f"\n[prompt]\n{prompt}\n[/prompt]")
    resp = await gemini.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0,
        ),
    )
    print(f"\n[llm response]\n{resp.text}\n[/llm response]")
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


ProgressCallback = Callable[[dict], Awaitable[None]]


async def _emit_progress(progress_cb: ProgressCallback | None, payload: dict) -> None:
    if progress_cb:
        await progress_cb(payload)


def _chunk_progress_start(index: int, total: int) -> int:
    # Reserve first 5% for setup and final 5% for completion.
    return 5 + int(((index - 1) / max(total, 1)) * 90)


async def ingest(text: str, chapter: int, progress_cb: ProgressCallback | None = None) -> dict:
    chunks = chunk_text(text)
    totals = {"entities": 0, "attributes": 0, "relationships": 0, "embedding_chunks": 0}
    prev_characters: list[str] | None = None
    total_chunks = len(chunks)

    await _emit_progress(progress_cb, {
        "percent": 2,
        "phase": "preparing",
        "message": "Chunking manuscript text",
        "chunk_index": 0,
        "total_chunks": total_chunks,
        "totals": totals,
    })

    if total_chunks == 0:
        await _emit_progress(progress_cb, {
            "percent": 100,
            "phase": "completed",
            "message": "No text to ingest",
            "chunk_index": 0,
            "total_chunks": 0,
            "totals": totals,
        })
        return totals

    for i, chunk in enumerate(chunks):
        chunk_num = i + 1
        start_pct = _chunk_progress_start(chunk_num, total_chunks)
        print(f"[ingest] chunk {chunk_num}/{total_chunks} ({len(chunk.split())} words)")
        await _emit_progress(progress_cb, {
            "percent": min(start_pct + 8, 95),
            "phase": "extracting",
            "message": f"Extracting entities and relationships from chunk {chunk_num}/{total_chunks}",
            "chunk_index": chunk_num,
            "total_chunks": total_chunks,
            "totals": totals,
        })
        extracted = await _extract(chunk, prev_characters=prev_characters)
        prev_characters = extracted.get("characters_present", [])
        if prev_characters:
            print(f"[ingest] characters_present: {prev_characters}")
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

            # embedding chunks
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
            await _emit_progress(progress_cb, {
                "percent": min(start_pct + 45, 95),
                "phase": "writing_graph",
                "message": f"Stored graph data for chunk {chunk_num}/{total_chunks}",
                "chunk_index": chunk_num,
                "total_chunks": total_chunks,
                "totals": totals,
            })

        # generate embeddings and push to VectorAI
        if valid_items:
            await _emit_progress(progress_cb, {
                "percent": min(start_pct + 65, 95),
                "phase": "embedding",
                "message": f"Generating embeddings for chunk {chunk_num}/{total_chunks}",
                "chunk_index": chunk_num,
                "total_chunks": total_chunks,
                "totals": totals,
            })
            summaries = [ec["behavioral_summary"] for _, ec in valid_items]
            vectors = await _embed(summaries)
            if db.vectorai_ready():
                for attempt in range(2):
                    try:
                        await db.vectorai.batch_upsert(
                            db.COLLECTION,
                            ids=sqlite_ids,
                            vectors=vectors,
                            payloads=[{"entity_id": char_id} for char_id, _ in valid_items],
                        )
                        await db.vectorai.flush(db.COLLECTION)
                        totals["embedding_chunks"] += len(valid_items)
                        print(f"[ingest] upserted {len(sqlite_ids)} vectors, ids={sqlite_ids}")
                        break
                    except Exception as e:
                        print(f"[ingest] VectorAI attempt {attempt+1} failed: {type(e).__name__}: {e}")
                        if attempt == 1:
                            print("[ingest] giving up on chunk vectors")
            else:
                print("[ingest] VectorAI unavailable; skipping vector upsert")

        await _emit_progress(progress_cb, {
            "percent": min(start_pct + 90, 95),
            "phase": "chunk_complete",
            "message": f"Finished chunk {chunk_num}/{total_chunks}",
            "chunk_index": chunk_num,
            "total_chunks": total_chunks,
            "totals": totals,
        })

    print(
        f"[ingest] done — {totals['entities']} entities, "
        f"{totals['attributes']} attributes, "
        f"{totals['relationships']} relationships, "
        f"{totals['embedding_chunks']} embedding chunks"
    )
    await _emit_progress(progress_cb, {
        "percent": 100,
        "phase": "completed",
        "message": "Ingestion complete",
        "chunk_index": total_chunks,
        "total_chunks": total_chunks,
        "totals": totals,
    })
    return totals

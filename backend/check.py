import json
import os

from cortex.filters import Filter, Field
from google import genai
from google.genai import types

import db

gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

CHECK_PROMPT = """\
You are a story consistency checker helping an author spot unintentional contradictions.

For each character below, you have:
- Their known attributes and relationships from the knowledge graph
- Relevant depth-2 context (factions, locations, connected characters)
- The 3 most similar past behavioral moments from vector search

Character context:
{context}

New text to check:
{text}

Identify only genuine contradictions — moments where the character acts,
speaks, or feels in a way that directly conflicts with their established
profile without narrative justification.

Do not flag: stylistic variation, minor tone shifts, actions that are
surprising but not contradictory.

Return ONLY valid JSON:
{{
  "flags": [
    {{
      "character": "Name",
      "issue": "specific description of the contradiction",
      "severity": "high|medium|low",
      "evidence": "what from the knowledge graph contradicts this",
      "suggestion": "how the author might resolve it"
    }}
  ]
}}"""


async def _embed(text: str) -> list[float]:
    resp = await gemini.aio.models.embed_content(
        model="models/gemini-embedding-001",
        contents=[text],
    )
    return resp.embeddings[0].values


async def _build_character_context(conn, name: str, scene_chars: list[str], query_vec: list[float]) -> dict:
    row = await (await conn.execute(
        "SELECT id, type, chapter_introduced FROM entities WHERE name = ?", (name,)
    )).fetchone()
    if not row:
        return {"name": name, "note": "not in knowledge graph"}

    eid = row["id"]

    # attributes
    attrs = [
        {"type": r["type"], "value": r["value"]}
        for r in await (await conn.execute(
            "SELECT type, value FROM attributes WHERE entity_id = ?", (eid,)
        )).fetchall()
    ]

    # depth-1 relationships
    depth1 = [
        {"rel_type": r["type"], "description": r["description"], "target": r["name"], "target_type": r["etype"]}
        for r in await (await conn.execute(
            """SELECT r.type, r.description, e.name, e.type AS etype
               FROM relationships r JOIN entities e ON e.id = r.to_id
               WHERE r.from_id = ?""",
            (eid,),
        )).fetchall()
    ]

    # depth-2: factions → their ally_of/enemy_of
    depth2 = []
    factions = await (await conn.execute(
        """SELECT e.id, e.name FROM relationships r JOIN entities e ON e.id = r.to_id
           WHERE r.from_id = ? AND r.type = 'member_of'""",
        (eid,),
    )).fetchall()
    for f in factions:
        for r in await (await conn.execute(
            """SELECT r.type, e.name FROM relationships r JOIN entities e ON e.id = r.to_id
               WHERE r.from_id = ? AND r.type IN ('enemy_of', 'ally_of')""",
            (f["id"],),
        )).fetchall():
            depth2.append({"via": f"faction:{f['name']}", "rel_type": r["type"], "target": r["name"]})

    # depth-2: locations → controls
    locations = await (await conn.execute(
        """SELECT e.id, e.name FROM relationships r JOIN entities e ON e.id = r.to_id
           WHERE r.from_id = ? AND r.type = 'located_in'""",
        (eid,),
    )).fetchall()
    for loc in locations:
        for r in await (await conn.execute(
            """SELECT r.type, e.name FROM relationships r JOIN entities e ON e.id = r.to_id
               WHERE r.from_id = ? AND r.type = 'controls'""",
            (loc["id"],),
        )).fetchall():
            depth2.append({"via": f"location:{loc['name']}", "rel_type": r["type"], "target": r["name"]})

    # depth-2: direct rels to other scene characters
    others = [c for c in scene_chars if c != name]
    if others:
        placeholders = ",".join("?" * len(others))
        for r in await (await conn.execute(
            f"""SELECT r.type, r.description, e.name FROM relationships r
                JOIN entities e ON e.id = r.to_id
                WHERE r.from_id = ? AND e.name IN ({placeholders})""",
            (eid, *others),
        )).fetchall():
            depth2.append({"via": "scene", "rel_type": r["type"], "target": r["name"], "description": r["description"]})

    # similar past moments via VectorAI
    vresults = await db.vectorai.search_filtered(
        db.COLLECTION,
        query_vec,
        Filter().must(Field("entity_id").eq(eid)),
        top_k=3,
        with_payload=True,
    )
    chunk_ids = [r.id for r in vresults]
    moments = []
    if chunk_ids:
        placeholders = ",".join("?" * len(chunk_ids))
        rows = await (await conn.execute(
            f"SELECT behavioral_summary FROM embedding_chunks WHERE id IN ({placeholders})",
            chunk_ids,
        )).fetchall()
        moments = [r["behavioral_summary"] for r in rows]

    return {
        "name": name,
        "attributes": attrs,
        "depth1_relationships": depth1,
        "depth2_context": depth2,
        "similar_past_moments": moments,
    }


async def consistency_check(text: str, characters_present: list[str], chapter: int) -> dict:
    query_vec = await _embed(text)

    contexts = []
    async with db.get_db() as conn:
        for name in characters_present:
            ctx = await _build_character_context(conn, name, characters_present, query_vec)
            contexts.append(ctx)

    resp = await gemini.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=CHECK_PROMPT.format(
            context=json.dumps(contexts, indent=2),
            text=text,
        ),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0,
        ),
    )
    return json.loads(resp.text)

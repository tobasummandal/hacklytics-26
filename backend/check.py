import json
import os
import asyncio
from collections import defaultdict
from typing import Any

from cortex.filters import Filter, Field
from google import genai
from google.genai import types

import db
from llm_log import log_gemini_usage

gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

MAX_CONTEXT_CHARS = 12000
MAX_ATTRIBUTES_PER_CHAR = 18
MAX_DEPTH1_PER_CHAR = 18
MAX_DEPTH2_PER_CHAR = 20
MAX_MOMENTS_PER_CHAR = 3
VECTOR_SEARCH_CONCURRENCY = 4

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
      "suggestion": "how the author might resolve it",
      "conflicting_excerpts": ["exact phrase or sentence from the new text that is in conflict"]
    }}
  ]
}}

Output Rules:
- The "evidence" field MUST contain exactly two sentences.
- The "suggestion" field MUST contain exactly two sentences.
- "conflicting_excerpts" must be exact substrings copied verbatim from the new text — do not paraphrase, do not truncate, do not alter punctuation or capitalisation.
- "conflicting_excerpts" can contain multiple entries if several phrases in the new text conflict. If the contradiction is about omission rather than a specific phrase, leave the array empty.
- Do not output reasoning.
- Do not output markdown.
- Do not output commentary.
- The response must be valid parsable JSON.
"""


async def _embed(text: str) -> list[float]:
    resp = await gemini.aio.models.embed_content(
        model="models/gemini-embedding-001",
        contents=[text],
    )
    log_gemini_usage("check_embed", resp)
    return resp.embeddings[0].values


def _placeholders(n: int) -> str:
    return ",".join("?" * n)


def _dedupe_keep_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        if v not in seen:
            seen.add(v)
            out.append(v)
    return out


async def _vector_chunk_ids_for_entity(eid: int, query_vec: list[float]) -> list[int]:
    if not db.vectorai_ready():
        return []
    try:
        vresults = await db.vectorai.search_filtered(
            db.COLLECTION,
            query_vec,
            Filter().must(Field("entity_id").eq(eid)),
            top_k=3,
        )
    except Exception as e:
        print(f"[check] VectorAI search skipped ({type(e).__name__}): {e}")
        return []

    out: list[int] = []
    for r in vresults:
        try:
            out.append(int(r.id))
        except (TypeError, ValueError):
            continue
    return out


def _cap(items: list[Any], n: int) -> list[Any]:
    return items[: max(0, n)]


def _trim_contexts_for_budget(contexts: list[dict], max_chars: int = MAX_CONTEXT_CHARS) -> list[dict]:
    """
    Keep context bounded for token control by trimming lower-priority lists.
    """
    trimmed = [
        {
            **ctx,
            "attributes": _cap(ctx.get("attributes", []), MAX_ATTRIBUTES_PER_CHAR),
            "depth1_relationships": _cap(ctx.get("depth1_relationships", []), MAX_DEPTH1_PER_CHAR),
            "depth2_context": _cap(ctx.get("depth2_context", []), MAX_DEPTH2_PER_CHAR),
            "similar_past_moments": _cap(ctx.get("similar_past_moments", []), MAX_MOMENTS_PER_CHAR),
        }
        for ctx in contexts
    ]

    # Iteratively shrink moments/depth2/depth1/attributes until under budget.
    order = ("similar_past_moments", "depth2_context", "depth1_relationships", "attributes")
    while len(json.dumps(trimmed, separators=(",", ":"))) > max_chars:
        reduced = False
        for key in order:
            for ctx in trimmed:
                seq = ctx.get(key, [])
                if isinstance(seq, list) and len(seq) > 0:
                    seq.pop()
                    reduced = True
            if reduced:
                break
        if not reduced:
            break
    return trimmed


async def _build_character_contexts(conn, scene_chars: list[str], query_vec: list[float]) -> list[dict]:
    ordered_chars = _dedupe_keep_order(scene_chars)
    if not ordered_chars:
        return []

    ph = _placeholders(len(ordered_chars))
    entity_rows = await (await conn.execute(
        f"SELECT id, type, chapter_introduced, name FROM entities WHERE name IN ({ph})",
        ordered_chars,
    )).fetchall()
    row_by_name = {r["name"]: r for r in entity_rows}
    known_eids = [r["id"] for r in entity_rows]
    if not known_eids:
        return [{"name": n, "note": "not in knowledge graph"} for n in ordered_chars]

    eid_ph = _placeholders(len(known_eids))

    attr_rows = await (await conn.execute(
        f"SELECT entity_id, type, value FROM attributes WHERE entity_id IN ({eid_ph})",
        known_eids,
    )).fetchall()
    attrs_by_eid: dict[int, list[dict]] = defaultdict(list)
    for r in attr_rows:
        attrs_by_eid[r["entity_id"]].append({"type": r["type"], "value": r["value"]})

    depth1_rows = await (await conn.execute(
        f"""SELECT r.from_id, r.type, r.description, e.name, e.type AS etype
            FROM relationships r
            JOIN entities e ON e.id = r.to_id
            WHERE r.from_id IN ({eid_ph})""",
        known_eids,
    )).fetchall()
    depth1_by_eid: dict[int, list[dict]] = defaultdict(list)
    for r in depth1_rows:
        depth1_by_eid[r["from_id"]].append({
            "rel_type": r["type"],
            "description": r["description"],
            "target": r["name"],
            "target_type": r["etype"],
        })

    member_rows = await (await conn.execute(
        f"""SELECT r.from_id AS char_id, e.id AS faction_id, e.name AS faction_name
            FROM relationships r
            JOIN entities e ON e.id = r.to_id
            WHERE r.from_id IN ({eid_ph}) AND r.type = 'member_of'""",
        known_eids,
    )).fetchall()
    faction_ids = _dedupe_keep_order([str(r["faction_id"]) for r in member_rows])
    faction_rel_by_fid: dict[int, list[dict]] = defaultdict(list)
    if faction_ids:
        fid_int = [int(x) for x in faction_ids]
        fid_ph = _placeholders(len(fid_int))
        faction_rel_rows = await (await conn.execute(
            f"""SELECT r.from_id, r.type, e.name
                FROM relationships r
                JOIN entities e ON e.id = r.to_id
                WHERE r.from_id IN ({fid_ph}) AND r.type IN ('enemy_of', 'ally_of')""",
            fid_int,
        )).fetchall()
        for r in faction_rel_rows:
            faction_rel_by_fid[r["from_id"]].append({"rel_type": r["type"], "target": r["name"]})

    depth2_faction_by_eid: dict[int, list[dict]] = defaultdict(list)
    for r in member_rows:
        fid = r["faction_id"]
        for rel in faction_rel_by_fid.get(fid, []):
            depth2_faction_by_eid[r["char_id"]].append({
                "via": f"faction:{r['faction_name']}",
                "rel_type": rel["rel_type"],
                "target": rel["target"],
            })

    location_rows = await (await conn.execute(
        f"""SELECT r.from_id AS char_id, e.id AS location_id, e.name AS location_name
            FROM relationships r
            JOIN entities e ON e.id = r.to_id
            WHERE r.from_id IN ({eid_ph}) AND r.type = 'located_in'""",
        known_eids,
    )).fetchall()
    location_ids = _dedupe_keep_order([str(r["location_id"]) for r in location_rows])
    controls_by_lid: dict[int, list[dict]] = defaultdict(list)
    if location_ids:
        lid_int = [int(x) for x in location_ids]
        lid_ph = _placeholders(len(lid_int))
        control_rows = await (await conn.execute(
            f"""SELECT r.from_id, r.type, e.name
                FROM relationships r
                JOIN entities e ON e.id = r.to_id
                WHERE r.from_id IN ({lid_ph}) AND r.type = 'controls'""",
            lid_int,
        )).fetchall()
        for r in control_rows:
            controls_by_lid[r["from_id"]].append({"rel_type": r["type"], "target": r["name"]})

    depth2_location_by_eid: dict[int, list[dict]] = defaultdict(list)
    for r in location_rows:
        lid = r["location_id"]
        for rel in controls_by_lid.get(lid, []):
            depth2_location_by_eid[r["char_id"]].append({
                "via": f"location:{r['location_name']}",
                "rel_type": rel["rel_type"],
                "target": rel["target"],
            })

    scene_by_eid: dict[int, list[dict]] = defaultdict(list)
    if len(known_eids) > 1:
        scene_rows = await (await conn.execute(
            f"""SELECT r.from_id, r.type, r.description, e.name
                FROM relationships r
                JOIN entities e ON e.id = r.to_id
                WHERE r.from_id IN ({eid_ph}) AND r.to_id IN ({eid_ph}) AND r.from_id != r.to_id""",
            known_eids + known_eids,
        )).fetchall()
        for r in scene_rows:
            scene_by_eid[r["from_id"]].append({
                "via": "scene",
                "rel_type": r["type"],
                "target": r["name"],
                "description": r["description"],
            })

    moments_by_eid: dict[int, list[str]] = defaultdict(list)
    if db.vectorai_ready():
        sem = asyncio.Semaphore(VECTOR_SEARCH_CONCURRENCY)

        async def _run(eid: int) -> list[int]:
            async with sem:
                return await _vector_chunk_ids_for_entity(eid, query_vec)

        chunk_id_lists = await asyncio.gather(*[_run(eid) for eid in known_eids])
        chunk_ids_by_eid = {eid: ids for eid, ids in zip(known_eids, chunk_id_lists)}
        all_chunk_ids = _dedupe_keep_order([str(cid) for ids in chunk_id_lists for cid in ids])
        if all_chunk_ids:
            all_chunk_int = [int(x) for x in all_chunk_ids]
            chunk_ph = _placeholders(len(all_chunk_int))
            chunk_rows = await (await conn.execute(
                f"SELECT id, behavioral_summary FROM embedding_chunks WHERE id IN ({chunk_ph})",
                all_chunk_int,
            )).fetchall()
            summary_by_chunk_id = {r["id"]: r["behavioral_summary"] for r in chunk_rows}
            for eid, chunk_ids in chunk_ids_by_eid.items():
                moments_by_eid[eid] = [summary_by_chunk_id[cid] for cid in chunk_ids if cid in summary_by_chunk_id]

    contexts: list[dict] = []
    for name in ordered_chars:
        row = row_by_name.get(name)
        if not row:
            contexts.append({"name": name, "note": "not in knowledge graph"})
            continue
        eid = row["id"]
        contexts.append({
            "name": name,
            "attributes": attrs_by_eid.get(eid, []),
            "depth1_relationships": depth1_by_eid.get(eid, []),
            "depth2_context": (
                depth2_faction_by_eid.get(eid, [])
                + depth2_location_by_eid.get(eid, [])
                + scene_by_eid.get(eid, [])
            ),
            "similar_past_moments": moments_by_eid.get(eid, []),
        })
    return _trim_contexts_for_budget(contexts)


async def consistency_check(text: str, characters_present: list[str], chapter: int) -> dict:
    query_vec = await _embed(text)
    async with db.get_db() as conn:
        contexts = await _build_character_contexts(conn, characters_present, query_vec)

    resp = await gemini.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=CHECK_PROMPT.format(
            context=json.dumps(contexts, separators=(",", ":")),
            text=text,
        ),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0,
        ),
    )
    log_gemini_usage("check_generate", resp)
    return json.loads(resp.text)

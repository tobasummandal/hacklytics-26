import json
import os
import time

from google import genai
from google.genai import types

import db
from llm_log import debug_llm, log_gemini_usage

gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

WHO_PROMPT = """\
Known characters in this story: {characters}

Passage:
{text}

Which of the known characters are present or being referenced in this passage?
This includes characters referred to by pronoun, implication, or dialogue without attribution.

Return ONLY valid JSON: {{"present": ["Name1", "Name2"]}}
If none are present, return {{"present": []}}"""

KNOWN_CHAR_CACHE_TTL_SECONDS = 5.0
_KNOWN_CHAR_CACHE: dict[str, object] = {"expires_at": 0.0, "names": []}


def clear_known_character_cache() -> None:
    _KNOWN_CHAR_CACHE["expires_at"] = 0.0
    _KNOWN_CHAR_CACHE["names"] = []


async def _get_known_characters() -> list[str]:
    now = time.time()
    expires_at = float(_KNOWN_CHAR_CACHE.get("expires_at", 0.0))
    if expires_at > now:
        return list(_KNOWN_CHAR_CACHE.get("names", []))

    async with db.get_db() as conn:
        rows = await (await conn.execute(
            "SELECT name FROM entities WHERE type = 'character'"
        )).fetchall()
    names = [r["name"] for r in rows]
    _KNOWN_CHAR_CACHE["names"] = names
    _KNOWN_CHAR_CACHE["expires_at"] = now + KNOWN_CHAR_CACHE_TTL_SECONDS
    return names


async def who_is_present(text: str) -> list[str]:
    known = await _get_known_characters()
    debug_llm(f"[who] known characters: {known}")
    if not known:
        debug_llm("[who] no characters in db, skipping")
        return []

    debug_llm(f"[who] querying gemini for: {text[:80]}{'...' if len(text) > 80 else ''}")
    try:
        resp = await gemini.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=WHO_PROMPT.format(
                characters=", ".join(known),
                text=text,
            ),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0,
            ),
        )
        log_gemini_usage("who", resp)
        result = json.loads(resp.text).get("present", [])
        debug_llm(f"[who] present: {result}")
        return result
    except Exception as e:
        print(f"[who] gemini call FAILED: {type(e).__name__}: {e}")
        raise

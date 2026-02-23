import json
import os

from google import genai
from google.genai import types

import db

gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

WHO_PROMPT = """\
Known characters in this story: {characters}

Passage:
{text}

Which of the known characters are present or being referenced in this passage?
This includes characters referred to by pronoun, implication, or dialogue without attribution.

Return ONLY valid JSON: {{"present": ["Name1", "Name2"]}}
If none are present, return {{"present": []}}"""


async def who_is_present(text: str) -> list[str]:
    async with db.get_db() as conn:
        rows = await (await conn.execute(
            "SELECT name FROM entities WHERE type = 'character'"
        )).fetchall()

    known = [r["name"] for r in rows]
    print(f"[who] known characters: {known}")
    if not known:
        print("[who] no characters in db, skipping")
        return []

    print(f"[who] querying gemini for: {text[:80]}{'...' if len(text) > 80 else ''}")
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
        result = json.loads(resp.text).get("present", [])
        print(f"[who] present: {result}")
        return result
    except Exception as e:
        print(f"[who] gemini call FAILED: {type(e).__name__}: {e}")
        raise

import db


async def get_graph(character_name: str) -> dict | None:
    async with db.get_db() as conn:
        row = await (await conn.execute(
            "SELECT id, type, name, chapter_introduced FROM entities WHERE name = ?",
            (character_name,),
        )).fetchone()
        if not row:
            return None

        eid = row["id"]

        attrs = [
            {"type": r["type"], "value": r["value"]}
            for r in await (await conn.execute(
                "SELECT type, value FROM attributes WHERE entity_id = ?", (eid,)
            )).fetchall()
        ]

        depth1 = [
            {"rel_type": r["type"], "description": r["description"],
             "target_name": r["name"], "target_type": r["etype"]}
            for r in await (await conn.execute(
                """SELECT r.type, r.description, e.name, e.type AS etype
                   FROM relationships r JOIN entities e ON e.id = r.to_id
                   WHERE r.from_id = ?""",
                (eid,),
            )).fetchall()
        ]

        factions = await (await conn.execute(
            """SELECT e.id, e.name FROM relationships r JOIN entities e ON e.id = r.to_id
               WHERE r.from_id = ? AND r.type = 'member_of'""",
            (eid,),
        )).fetchall()

        depth2 = []
        for f in factions:
            for r in await (await conn.execute(
                """SELECT r.type, r.description, e.name, e.type AS etype
                   FROM relationships r JOIN entities e ON e.id = r.to_id
                   WHERE r.from_id = ?""",
                (f["id"],),
            )).fetchall():
                depth2.append({
                    "via_faction": f["name"],
                    "rel_type": r["type"],
                    "description": r["description"],
                    "target_name": r["name"],
                    "target_type": r["etype"],
                })

        return {
            "entity": dict(row),
            "attributes": attrs,
            "depth1": depth1,
            "depth2_faction_context": depth2,
        }

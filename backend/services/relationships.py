import os
import json
from typing import List, Dict
from openai import OpenAI
from services.vectorai import VectorAIService

class RelationshipExtractionService:
    """
    Extracts subject-relation-object triplets from story chunks and stores
    them in VectorAI DB — making Actian the relational knowledge graph layer,
    not just a vector store.
    """

    def __init__(self, vectorai_service: VectorAIService):
        self.vectorai = vectorai_service
        api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=api_key) if api_key else None

    async def extract_relationships(self, world_id: str) -> int:
        chunks = await self.vectorai.scroll(f"world_{world_id}_chunks")
        if not chunks:
            return 0

        relationships = []
        for chunk in chunks[:50]:
            text = chunk.get('payload', {}).get('text', '')
            if len(text) < 20:
                continue
            extracted = await self._extract_from_text(text, world_id)
            relationships.extend(extracted)

        if relationships:
            # Embed the full triplet as text: "subject relation object"
            triplet_texts = [f"{r['subject']} {r['relation']} {r['object']}" for r in relationships]
            embeddings = self.vectorai.generate_embeddings(triplet_texts)
            ids = [self.vectorai._generate_id(t) for t in triplet_texts]

            await self.vectorai.batch_upsert(
                f"world_{world_id}_relationships",
                ids,
                embeddings,
                relationships
            )

        return len(relationships)

    async def get_relationships(self, world_id: str) -> List[Dict]:
        results = await self.vectorai.scroll(f"world_{world_id}_relationships")
        return [r.get('payload', {}) for r in results]

    async def _extract_from_text(self, text: str, world_id: str) -> List[Dict]:
        if self.client:
            return await self._llm_extract(text, world_id)
        return self._fallback_extract(text, world_id)

    async def _llm_extract(self, text: str, world_id: str) -> List[Dict]:
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "Extract subject-relation-object triplets from fictional text. Focus on character abilities, rules, and world facts."
                    },
                    {
                        "role": "user",
                        "content": f"""Extract entity relationships from this text as triplets:

{text}

Return JSON:
{{
  "triplets": [
    {{"subject": "entity name", "relation": "relation_type", "object": "entity or value"}}
  ]
}}

Examples: {{"subject": "Aria", "relation": "born_in", "object": "summer"}},
          {{"subject": "fire magic", "relation": "restricted_to", "object": "Blood Moon born"}}"""
                    }
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            result = json.loads(response.choices[0].message.content)
            triplets = result.get('triplets', [])
            for t in triplets:
                t['world_id'] = world_id
                t['source_text'] = text[:100]
            return triplets
        except Exception as e:
            print(f"Error in relationship extraction: {e}")
            return self._fallback_extract(text, world_id)

    def _fallback_extract(self, text: str, world_id: str) -> List[Dict]:
        # Simple heuristic: look for "X can/cannot Y" patterns
        import re
        triplets = []
        patterns = [
            (r'(\w+) can (\w+)', 'can'),
            (r'(\w+) cannot (\w+)', 'cannot'),
            (r'only (\w+) (?:can|may) (\w+)', 'restricted_to'),
        ]
        for pattern, relation in patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                triplets.append({
                    'subject': match.group(1),
                    'relation': relation,
                    'object': match.group(2),
                    'world_id': world_id,
                    'source_text': text[:100]
                })
        return triplets[:5]

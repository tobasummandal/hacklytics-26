import os
import json
from typing import List, Dict
from openai import OpenAI
from services.vectorai import VectorAIService
from models.schemas import CharacterProfile, TraitType

class CharacterTrackerService:
    def __init__(self, vectorai_service: VectorAIService):
        self.vectorai = vectorai_service
        api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=api_key) if api_key else None
    
    async def get_all_characters(self, world_id: str) -> List[CharacterProfile]:
        characters_data = await self.vectorai.scroll(f"world_{world_id}_characters")
        
        if not characters_data:
            return []
        
        characters_by_name = {}
        
        for char in characters_data:
            payload = char.get('payload', {})
            name = payload.get('character_name', '')
            
            if name not in characters_by_name:
                characters_by_name[name] = []
            
            characters_by_name[name].append({
                'trait_type': payload.get('trait_type', 'other'),
                'description': payload.get('description', ''),
                'confidence': 1.0
            })
        
        profiles = []
        
        for name, traits in characters_by_name.items():
            profile = await self._build_character_profile(name, traits)
            profiles.append(profile)
        
        return profiles
    
    async def _build_character_profile(self, name: str, traits: List[Dict]) -> CharacterProfile:
        moral_traits = [t for t in traits if t['trait_type'] == TraitType.MORAL]
        ability_traits = [t for t in traits if t['trait_type'] == TraitType.ABILITY]
        motivation_traits = [t for t in traits if t['trait_type'] == TraitType.MOTIVATION]
        
        moral_alignment = moral_traits[0]['description'] if moral_traits else None
        primary_ability = ability_traits[0]['description'] if ability_traits else None
        motivation = motivation_traits[0]['description'] if motivation_traits else None
        
        consistency_score = self._calculate_consistency_score(traits)
        
        warning = None
        if consistency_score < 0.75:
            warning = "Character behavior shows inconsistencies. Review for potential character drift."
        
        return CharacterProfile(
            character_name=name,
            traits=traits,
            moral_alignment=moral_alignment,
            primary_ability=primary_ability,
            motivation=motivation,
            consistency_score=consistency_score,
            warning=warning
        )
    
    def _calculate_consistency_score(self, traits: List[Dict]) -> float:
        if len(traits) < 2:
            return 1.0
        
        base_score = 0.85
        
        trait_types = [t['trait_type'] for t in traits]
        unique_traits = len(set(trait_types))
        
        if unique_traits > len(trait_types) * 0.8:
            base_score -= 0.15
        
        return max(0.0, min(1.0, base_score))
    
    async def extract_characters_from_chunks(self, world_id: str) -> int:
        chunks = await self.vectorai.scroll(f"world_{world_id}_chunks")
        
        if not chunks:
            return 0
        
        characters = []
        
        for chunk in chunks[:30]:
            payload = chunk.get('payload', {})
            text = payload.get('text', '')
            
            extracted_chars = await self._extract_characters_from_text(text, world_id)
            
            if extracted_chars:
                characters.extend(extracted_chars)
        
        if characters:
            char_texts = [c['description'] for c in characters]
            embeddings = self.vectorai.generate_embeddings(char_texts)
            
            ids = [hash(c['character_name'] + c['description']) % (10**9) for c in characters]
            
            await self.vectorai.batch_upsert(
                f"world_{world_id}_characters",
                ids,
                embeddings,
                characters
            )
        
        return len(characters)
    
    async def _extract_characters_from_text(self, text: str, world_id: str) -> List[Dict]:
        if not self.client:
            return []
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "Extract character information from text. Focus on traits, abilities, motivations, and relationships."
                    },
                    {
                        "role": "user",
                        "content": f"""Extract characters and their traits from this text:

{text}

Return JSON array of characters:
{{
  "characters": [
    {{
      "character_name": "name",
      "trait_type": "moral|ability|relationship|motivation",
      "description": "trait description"
    }}
  ]
}}"""
                    }
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            characters = result.get('characters', [])
            
            for char in characters:
                char['world_id'] = world_id
                char['first_seen_chapter'] = None
                char['last_seen_chapter'] = None
            
            return characters
            
        except Exception as e:
            print(f"Error extracting characters: {e}")
            return []

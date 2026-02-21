import os
import json
from typing import List, Dict
from openai import OpenAI
from services.vectorai import VectorAIService
from models.schemas import SystemType

class RuleExtractionService:
    def __init__(self, vectorai_service: VectorAIService):
        self.vectorai = vectorai_service
        api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=api_key) if api_key else None
    
    async def extract_rules(self, world_id: str) -> int:
        chunks = await self.vectorai.scroll(f"world_{world_id}_chunks")
        
        if not chunks:
            return 0
        
        rules = []
        
        for chunk in chunks[:50]:
            payload = chunk.get('payload', {})
            text = payload.get('text', '')
            
            if len(text) < 20:
                continue
            
            extracted_rules = await self._extract_rules_from_text(text, world_id)
            
            if extracted_rules:
                rules.extend(extracted_rules)
        
        if rules:
            rule_texts = [r['text'] for r in rules]
            embeddings = self.vectorai.generate_embeddings(rule_texts)
            
            ids = [self.vectorai._generate_id(r['text']) for r in rules]
            
            await self.vectorai.batch_upsert(
                f"world_{world_id}_rules",
                ids,
                embeddings,
                [r for r in rules]
            )
        
        return len(rules)
    
    async def _extract_rules_from_text(self, text: str, world_id: str) -> List[Dict]:
        if not self.client:
            return self._fallback_rule_extraction(text, world_id)
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at identifying world-building rules from fictional text. Extract clear, explicit rules about how the world works. Return a JSON array of rules."
                    },
                    {
                        "role": "user",
                        "content": f"""Extract world-building rules from this text:

{text}

Return a JSON array where each rule has:
- text: the rule statement
- system: one of [magic, politics, technology, economy, culture, other]
- confidence: 0-1 score

Only include explicit rules, not descriptions or events."""
                    }
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            rules = result.get('rules', [])
            
            for rule in rules:
                rule['world_id'] = world_id
                rule['chapter'] = None
                rule['page'] = None
            
            return rules
            
        except Exception as e:
            print(f"Error in rule extraction: {e}")
            return self._fallback_rule_extraction(text, world_id)
    
    def _fallback_rule_extraction(self, text: str, world_id: str) -> List[Dict]:
        keywords = {
            'magic': ['magic', 'spell', 'enchant', 'wizard', 'sorcery', 'mana'],
            'politics': ['king', 'queen', 'law', 'govern', 'rule', 'empire', 'kingdom'],
            'technology': ['machine', 'invent', 'device', 'automata', 'tech'],
            'economy': ['trade', 'gold', 'coin', 'merchant', 'price', 'sell', 'buy'],
            'culture': ['tradition', 'custom', 'belief', 'ritual', 'festival']
        }
        
        detected_system = SystemType.OTHER
        text_lower = text.lower()
        
        for system, words in keywords.items():
            if any(word in text_lower for word in words):
                detected_system = system
                break
        
        if any(indicator in text_lower for indicator in ['must', 'cannot', 'only', 'never', 'always', 'forbidden']):
            return [{
                'text': text,
                'system': detected_system,
                'world_id': world_id,
                'chapter': None,
                'page': None,
                'confidence': 0.6
            }]
        
        return []

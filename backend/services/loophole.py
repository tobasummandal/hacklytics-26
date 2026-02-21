import os
import json
from typing import List, Dict
from openai import OpenAI
from services.vectorai import VectorAIService
from models.schemas import LoopholeReport, SystemType

class LoopholeGeneratorService:
    def __init__(self, vectorai_service: VectorAIService):
        self.vectorai = vectorai_service
        api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=api_key) if api_key else None
    
    async def generate_loopholes(self, world_id: str) -> List[LoopholeReport]:
        rules = await self.vectorai.scroll(f"world_{world_id}_rules")
        
        if len(rules) < 3:
            return []
        
        rules_by_system = {}
        for rule in rules:
            system = rule.get('payload', {}).get('system', 'other')
            if system not in rules_by_system:
                rules_by_system[system] = []
            rules_by_system[system].append(rule)
        
        loopholes = []
        
        system_pairs = [
            ('magic', 'politics'),
            ('technology', 'economy'),
            ('magic', 'technology'),
            ('politics', 'economy')
        ]
        
        for system_a, system_b in system_pairs:
            if system_a in rules_by_system and system_b in rules_by_system:
                loophole = await self._find_cross_system_loophole(
                    rules_by_system[system_a][:3],
                    rules_by_system[system_b][:3],
                    system_a,
                    system_b
                )
                
                if loophole:
                    loopholes.append(loophole)
        
        return loopholes[:5]
    
    async def _find_cross_system_loophole(
        self,
        rules_a: List[Dict],
        rules_b: List[Dict],
        system_a: str,
        system_b: str
    ) -> LoopholeReport:
        if not self.client:
            return self._fallback_loophole_generation(rules_a, rules_b, system_a, system_b)
        
        try:
            rules_a_text = "\n".join([f"- {r.get('payload', {}).get('text', '')}" for r in rules_a])
            rules_b_text = "\n".join([f"- {r.get('payload', {}).get('text', '')}" for r in rules_b])
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a creative analyst finding clever loopholes by combining rules from different systems in a fictional world."
                    },
                    {
                        "role": "user",
                        "content": f"""Find a creative loophole by combining these rules:

{system_a.upper()} SYSTEM:
{rules_a_text}

{system_b.upper()} SYSTEM:
{rules_b_text}

Return JSON:
{{
  "title": "brief catchy title",
  "description": "explanation of the loophole",
  "creativity_score": 0-1 float
}}"""
                    }
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            
            exploitable_rules = [
                {'text': r.get('payload', {}).get('text', ''), 'system': system_a}
                for r in rules_a
            ] + [
                {'text': r.get('payload', {}).get('text', ''), 'system': system_b}
                for r in rules_b
            ]
            
            return LoopholeReport(
                title=result.get('title', 'Cross-system Loophole'),
                systems_involved=[system_a, system_b],
                description=result.get('description', 'No description available'),
                exploitable_rules=exploitable_rules,
                creativity_score=result.get('creativity_score', 0.5)
            )
            
        except Exception as e:
            print(f"Error generating loophole: {e}")
            return self._fallback_loophole_generation(rules_a, rules_b, system_a, system_b)
    
    def _fallback_loophole_generation(
        self,
        rules_a: List[Dict],
        rules_b: List[Dict],
        system_a: str,
        system_b: str
    ) -> LoopholeReport:
        exploitable_rules = [
            {'text': r.get('payload', {}).get('text', ''), 'system': system_a}
            for r in rules_a[:2]
        ] + [
            {'text': r.get('payload', {}).get('text', ''), 'system': system_b}
            for r in rules_b[:2]
        ]
        
        return LoopholeReport(
            title=f"Cross-system: {system_a.title()} + {system_b.title()}",
            systems_involved=[system_a, system_b],
            description=f"By combining rules from the {system_a} and {system_b} systems, characters could potentially find creative ways to achieve goals that would otherwise be restricted by either system alone.",
            exploitable_rules=exploitable_rules,
            creativity_score=0.6
        )

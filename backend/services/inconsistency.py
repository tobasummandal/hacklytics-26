import os
import json
from typing import List, Dict
from openai import OpenAI
from services.vectorai import VectorAIService
from models.schemas import InconsistencyReport, SeverityLevel

class InconsistencyDetectionService:
    def __init__(self, vectorai_service: VectorAIService):
        self.vectorai = vectorai_service
        api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=api_key) if api_key else None
        self.similarity_threshold = 0.65
    
    async def detect_inconsistencies(self, world_id: str) -> List[InconsistencyReport]:
        rules = await self.vectorai.scroll(f"world_{world_id}_rules")
        
        if len(rules) < 2:
            return []
        
        inconsistencies = []
        
        for i, rule_a in enumerate(rules):
            rule_a_vector = rule_a.get('vector', [])
            if not rule_a_vector:
                continue
            
            similar_rules = await self.vectorai.search(
                f"world_{world_id}_rules",
                rule_a_vector,
                top_k=5
            )
            
            for rule_b in similar_rules:
                if rule_b['id'] == rule_a['id']:
                    continue
                
                similarity = rule_b.get('score', 0)
                
                if similarity > self.similarity_threshold:
                    is_contradiction = await self._check_contradiction(
                        rule_a.get('payload', {}),
                        rule_b.get('payload', {})
                    )
                    
                    if is_contradiction:
                        severity = self._determine_severity(similarity)
                        
                        inconsistencies.append(InconsistencyReport(
                            severity=severity,
                            similarity=similarity,
                            rule_a={
                                'text': rule_a.get('payload', {}).get('text', ''),
                                'chapter': rule_a.get('payload', {}).get('chapter'),
                                'page': rule_a.get('payload', {}).get('page'),
                                'system': rule_a.get('payload', {}).get('system')
                            },
                            rule_b={
                                'text': rule_b.get('payload', {}).get('text', ''),
                                'chapter': rule_b.get('payload', {}).get('chapter'),
                                'page': rule_b.get('payload', {}).get('page'),
                                'system': rule_b.get('payload', {}).get('system')
                            },
                            explanation=is_contradiction
                        ))
        
        return inconsistencies[:10]
    
    async def _check_contradiction(self, rule_a: Dict, rule_b: Dict) -> str:
        if not self.client:
            return self._fallback_contradiction_check(rule_a, rule_b)
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at identifying logical contradictions in fictional world-building rules. Analyze if two rules contradict each other."
                    },
                    {
                        "role": "user",
                        "content": f"""Do these two rules contradict each other?

Rule A: {rule_a.get('text', '')}
Rule B: {rule_b.get('text', '')}

Respond with JSON:
{{
  "is_contradiction": true/false,
  "explanation": "brief explanation if true, empty string if false"
}}"""
                    }
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            
            if result.get('is_contradiction', False):
                return result.get('explanation', 'Logical contradiction detected')
            
            return ""
            
        except Exception as e:
            print(f"Error checking contradiction: {e}")
            return self._fallback_contradiction_check(rule_a, rule_b)
    
    def _fallback_contradiction_check(self, rule_a: Dict, rule_b: Dict) -> str:
        text_a = rule_a.get('text', '').lower()
        text_b = rule_b.get('text', '').lower()
        
        contradiction_indicators = [
            ('only', 'also'),
            ('never', 'always'),
            ('cannot', 'can'),
            ('forbidden', 'allowed'),
            ('impossible', 'possible')
        ]
        
        for neg, pos in contradiction_indicators:
            if neg in text_a and pos in text_b:
                return f"Potential contradiction: '{neg}' vs '{pos}'"
            if pos in text_a and neg in text_b:
                return f"Potential contradiction: '{pos}' vs '{neg}'"
        
        return ""
    
    def _determine_severity(self, similarity: float) -> SeverityLevel:
        if similarity > 0.85:
            return SeverityLevel.HIGH
        elif similarity > 0.75:
            return SeverityLevel.MEDIUM
        else:
            return SeverityLevel.LOW

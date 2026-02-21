import hashlib
from typing import List
from docx import Document
from services.vectorai import VectorAIService

class IngestionService:
    def __init__(self, vectorai_service: VectorAIService):
        self.vectorai = vectorai_service
    
    async def ingest_manuscript(self, world_id: str, file_path: str) -> int:
        if file_path.endswith('.docx'):
            chunks = self._parse_docx(file_path)
        else:
            chunks = self._parse_txt(file_path)
        
        if not chunks:
            return 0
        
        embeddings = self.vectorai.generate_embeddings(chunks)
        
        ids = [self._generate_id(chunk) for chunk in chunks]
        
        payloads = [
            {
                "text": chunk,
                "world_id": world_id,
                "chunk_idx": i,
                "has_rule": False
            }
            for i, chunk in enumerate(chunks)
        ]
        
        await self.vectorai.batch_upsert(
            f"world_{world_id}_chunks",
            ids,
            embeddings,
            payloads
        )
        
        return len(chunks)
    
    def _parse_docx(self, file_path: str) -> List[str]:
        try:
            doc = Document(file_path)
            chunks = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
            return chunks
        except Exception as e:
            print(f"Error parsing DOCX: {e}")
            return []
    
    def _parse_txt(self, file_path: str) -> List[str]:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            paragraphs = content.split('\n\n')
            chunks = [p.strip() for p in paragraphs if p.strip()]
            return chunks
        except Exception as e:
            print(f"Error parsing TXT: {e}")
            return []
    
    def _generate_id(self, text: str) -> int:
        hash_obj = hashlib.md5(text.encode())
        return int(hash_obj.hexdigest(), 16) % (10**9)

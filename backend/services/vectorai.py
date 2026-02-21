import os
from typing import List, Dict, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
from cortex import CortexClient, DistanceMetric
from models.schemas import GraphData, GraphNode, GraphEdge, SystemType

class VectorAIService:
    def __init__(self):
        self.host = os.getenv("VECTORAI_HOST", "localhost")
        self.port = int(os.getenv("VECTORAI_PORT", "50051"))
        self.client = None
        self.model = SentenceTransformer("all-MiniLM-L6-v2")
        self.dimension = 384
        
    async def connect(self):
        self.client = CortexClient(f"{self.host}:{self.port}")
        
    async def disconnect(self):
        if self.client:
            self.client.__exit__(None, None, None)
    
    async def create_world_collections(self, world_id: str):
        collections = [
            f"world_{world_id}_chunks",
            f"world_{world_id}_rules",
            f"world_{world_id}_characters",
            f"world_{world_id}_settings"
        ]
        
        for collection_name in collections:
            try:
                self.client.get_or_create_collection(
                    name=collection_name,
                    dimension=self.dimension,
                    distance_metric=DistanceMetric.COSINE
                )
            except Exception as e:
                print(f"Error creating collection {collection_name}: {e}")
    
    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        embeddings = self.model.encode(texts)
        return embeddings.tolist()
    
    async def batch_upsert(
        self,
        collection_name: str,
        ids: List[int],
        vectors: List[List[float]],
        payloads: List[Dict]
    ):
        try:
            self.client.batch_upsert(
                collection_name,
                ids,
                vectors,
                payloads
            )
        except Exception as e:
            print(f"Error during batch_upsert: {e}")
            raise
    
    async def search(
        self,
        collection_name: str,
        query_vector: List[float],
        top_k: int = 10,
        filters: Optional[Dict] = None
    ) -> List[Dict]:
        try:
            if filters:
                results = self.client.search_filtered(
                    collection_name,
                    query_vector,
                    top_k,
                    filters
                )
            else:
                results = self.client.search(
                    collection_name,
                    query_vector,
                    top_k
                )
            return results
        except Exception as e:
            print(f"Error during search: {e}")
            return []
    
    async def scroll(self, collection_name: str) -> List[Dict]:
        try:
            results = self.client.scroll(collection_name)
            return results
        except Exception as e:
            print(f"Error during scroll: {e}")
            return []
    
    async def get_world_stats(self, world_id: str) -> Dict:
        try:
            rules = await self.scroll(f"world_{world_id}_rules")
            characters = await self.scroll(f"world_{world_id}_characters")
            
            return {
                "rules": len(rules),
                "characters": len(set([c.get('payload', {}).get('character_name', '') for c in characters]))
            }
        except Exception as e:
            print(f"Error getting stats: {e}")
            return {"rules": 0, "characters": 0}
    
    async def semantic_search(
        self,
        world_id: str,
        query: str,
        top_k: int = 5
    ) -> List[Dict]:
        query_embedding = self.generate_embeddings([query])[0]
        
        results = await self.search(
            f"world_{world_id}_rules",
            query_embedding,
            top_k
        )
        
        return results
    
    async def build_knowledge_graph(self, world_id: str) -> GraphData:
        rules = await self.scroll(f"world_{world_id}_rules")
        characters = await self.scroll(f"world_{world_id}_characters")
        
        nodes = []
        edges = []
        
        system_colors = {
            SystemType.MAGIC: "#9333ea",
            SystemType.POLITICS: "#dc2626",
            SystemType.TECHNOLOGY: "#2563eb",
            SystemType.ECONOMY: "#16a34a",
            SystemType.CULTURE: "#f59e0b",
            SystemType.OTHER: "#6b7280"
        }
        
        for rule in rules:
            payload = rule.get('payload', {})
            system = payload.get('system', 'other')
            
            nodes.append(GraphNode(
                id=f"rule_{rule['id']}",
                label=payload.get('text', '')[:50] + "...",
                type="rule",
                system=system,
                color=system_colors.get(system, "#6b7280"),
                size=15
            ))
        
        character_names = set()
        for char in characters:
            payload = char.get('payload', {})
            char_name = payload.get('character_name', '')
            
            if char_name and char_name not in character_names:
                character_names.add(char_name)
                nodes.append(GraphNode(
                    id=f"char_{char_name}",
                    label=char_name,
                    type="character",
                    color="#ec4899",
                    size=20
                ))
        
        if len(rules) > 1:
            vectors = np.array([r.get('vector', []) for r in rules if r.get('vector')])
            
            if len(vectors) > 0:
                similarities = np.dot(vectors, vectors.T)
                
                for i in range(len(rules)):
                    for j in range(i + 1, min(i + 5, len(rules))):
                        if similarities[i][j] > 0.65:
                            edges.append(GraphEdge(
                                from_node=f"rule_{rules[i]['id']}",
                                to_node=f"rule_{rules[j]['id']}",
                                weight=float(similarities[i][j])
                            ))
        
        return GraphData(nodes=nodes, edges=edges)

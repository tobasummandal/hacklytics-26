from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum

class SystemType(str, Enum):
    MAGIC = "magic"
    POLITICS = "politics"
    TECHNOLOGY = "technology"
    ECONOMY = "economy"
    CULTURE = "culture"
    OTHER = "other"

class TraitType(str, Enum):
    MORAL = "moral"
    ABILITY = "ability"
    RELATIONSHIP = "relationship"
    MOTIVATION = "motivation"

class SeverityLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class World(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    rule_count: int = 0
    character_count: int = 0

class Rule(BaseModel):
    id: int
    world_id: str
    text: str
    system: SystemType
    chapter: Optional[int] = None
    page: Optional[int] = None
    confidence: float
    embedding: Optional[List[float]] = None

class Character(BaseModel):
    id: int
    world_id: str
    character_name: str
    trait_type: TraitType
    description: str
    first_seen_chapter: Optional[int] = None
    last_seen_chapter: Optional[int] = None
    embedding: Optional[List[float]] = None

class Chunk(BaseModel):
    id: int
    world_id: str
    text: str
    chunk_idx: int
    chapter: Optional[int] = None
    has_rule: bool = False
    embedding: Optional[List[float]] = None

class InconsistencyReport(BaseModel):
    severity: SeverityLevel
    similarity: float
    rule_a: Dict
    rule_b: Dict
    explanation: str

class LoopholeReport(BaseModel):
    title: str
    systems_involved: List[SystemType]
    description: str
    exploitable_rules: List[Dict]
    creativity_score: float

class CharacterProfile(BaseModel):
    character_name: str
    traits: List[Dict]
    moral_alignment: Optional[str] = None
    primary_ability: Optional[str] = None
    motivation: Optional[str] = None
    consistency_score: float
    warning: Optional[str] = None

class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    system: Optional[SystemType] = None
    color: Optional[str] = None
    size: int = 10

class GraphEdge(BaseModel):
    from_node: str
    to_node: str
    weight: float
    label: Optional[str] = None

class GraphData(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]

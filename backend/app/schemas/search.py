"""Pydantic schemas for search, graph, chat, entities, and dashboard"""

from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime, date


# ─── Search ───────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    case_id: Optional[int] = None
    entity_types: Optional[List[str]] = None
    top_k: int = 10


class SearchResult(BaseModel):
    chunk_id: int
    document_id: int
    document_name: str
    case_id: int
    case_number: str
    content: str
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    bm25_score: float = 0.0
    semantic_score: float = 0.0
    hybrid_score: float = 0.0


class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int
    query: str
    entities_found: List["EntityBrief"] = []


# ─── Graph ────────────────────────────────────────────────

class GraphNode(BaseModel):
    id: int
    label: str
    type: str
    mention_count: int = 1
    cluster_id: int = 0
    metadata: Optional[dict] = None


class GraphEdge(BaseModel):
    source: int
    target: int
    type: str
    label: Optional[str] = None
    confidence: float = 1.0
    evidence_count: int = 1
    weight: float = 1.0


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


class EntityProfile(BaseModel):
    id: int
    entity_type: str
    entity_value: str
    normalized_value: Optional[str] = None
    mention_count: int = 1
    first_seen_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    cases: List[dict] = []
    related_entities: List[dict] = []
    source_documents: List[dict] = []


class EntityBrief(BaseModel):
    id: int
    entity_type: str
    entity_value: str
    case_id: int

    class Config:
        from_attributes = True


# ─── Chat ─────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[int] = None


class ChatSource(BaseModel):
    document_id: int
    document_name: str
    chunk_id: int
    page: Optional[int] = None
    snippet: str


class ChatResponse(BaseModel):
    answer: str
    sources: List[ChatSource] = []
    related_entities: List[EntityBrief] = []
    confidence: str = "Based on available case records"
    session_id: int
    latency_ms: int = 0


# ─── Events / Timeline ───────────────────────────────────

class EventResponse(BaseModel):
    id: int
    case_id: int
    event_date: Optional[date] = None
    event_time: Optional[str] = None
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    event_type: str = "OTHER"
    source_document: Optional[str] = None
    is_ai_generated: bool = False
    confidence: float = 1.0

    class Config:
        from_attributes = True


class TimelineResponse(BaseModel):
    events: List[EventResponse]
    total: int


# ─── Dashboard ────────────────────────────────────────────

class DashboardStats(BaseModel):
    active_cases: int = 0
    total_documents: int = 0
    total_entities: int = 0
    pending_alerts: int = 0


class RecentActivity(BaseModel):
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    details: Optional[str] = None
    created_at: Optional[datetime] = None


class DashboardResponse(BaseModel):
    stats: DashboardStats
    recent_cases: List[Any] = []
    recent_activity: List[RecentActivity] = []

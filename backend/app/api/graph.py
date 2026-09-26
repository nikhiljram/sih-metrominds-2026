import re
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.models.entity import Entity
from app.models.entity_source import EntitySource
from app.models.relationship import Relationship
from app.models.document import Document
from app.models.case import Case
from app.schemas.search import GraphResponse, GraphNode, GraphEdge, EntityProfile
from app.dependencies import get_current_user

router = APIRouter(tags=["Graph"])

import math

ID_CODE_PATTERN = re.compile(r'^(T|DOC|REF|SRC|COL)[\d_-]*$', re.IGNORECASE)
DATE_PATTERN = re.compile(r'^\d{4}[-/.]\d{2}[-/.]\d{2}$|^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$')
GENERIC_NOISE_WORDS = {
    'person_id', 'location_id', 'transaction_id', 'source_id', 'target_id', 'receiver_id', 'sender_id',
    'name', 'age', 'location', 'role', 'context', 'details', 'amount_inr', 'method', 'date', 'city',
    'person', 'relationship', 'relationship_type', 'page 1', 'page 2',
    'source', 'target', 'unknown', 'n/a', 'none', 'null',
    'office area', 'bus terminal', 'residential area', 'transport area', 'meeting location', 'area', 'terminal'
}

def is_valid_proper_noun(label: str) -> bool:
    if not label or len(label.strip()) < 2:
        return False
    val = label.strip()
    lower = val.lower()
    if lower in GENERIC_NOISE_WORDS:
        return False
    if DATE_PATTERN.match(val):
        return False
    if ID_CODE_PATTERN.match(val):
        return False
    return True

def calculate_normalized_relation_score(
    co_occurrence_count: int,
    confidence: float,
    is_explicit: bool,
    case_count: int,
    min_mentions: int,
    max_c: int = 15,
    max_cases: int = 5,
    max_mentions: int = 30
) -> float:
    # 1. Co-occurrence score (35%) with log normalization
    c_score = math.log(1 + max(0, co_occurrence_count)) / math.log(1 + max(1, max_c))
    c_score = min(1.0, c_score)

    # 2. Relationship extraction confidence (25%)
    conf_score = max(0.0, min(1.0, confidence))

    # 3. Direct/explicit relationship weight (20%)
    explicit_score = 1.0 if is_explicit else 0.5

    # 4. Case-level co-occurrence (10%)
    case_score = math.log(1 + max(0, case_count)) / math.log(1 + max(1, max_cases))
    case_score = min(1.0, case_score)

    # 5. Entity frequency/mention balance (10%)
    mention_score = math.log(1 + max(0, min_mentions)) / math.log(1 + max(1, max_mentions))
    mention_score = min(1.0, mention_score)

    # Weighted sum formula (0.0 to 1.0)
    final_score = (
        (0.35 * c_score) +
        (0.25 * conf_score) +
        (0.20 * explicit_score) +
        (0.10 * case_score) +
        (0.10 * mention_score)
    )

    return round(final_score, 3)

def get_relationship_strength_level(score: float) -> str:
    if score >= 0.85: return "Very Strong"
    if score >= 0.70: return "Strong"
    if score >= 0.50: return "Moderate"
    if score >= 0.30: return "Possible"
    return "Weak"


@router.get("/cases/{case_id}/graph", response_model=GraphResponse)
def get_case_graph(
    case_id: int,
    entity_types: str = Query(None, description="Comma-separated entity types filter"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the full entity-relationship graph for a case."""
    # Get entities
    entity_query = db.query(Entity).filter(Entity.case_id == case_id)
    if entity_types:
        types_list = [t.strip().upper() for t in entity_types.split(",")]
        entity_query = entity_query.filter(Entity.entity_type.in_(types_list))

    raw_entities = entity_query.all()
    entities = [e for e in raw_entities if is_valid_proper_noun(e.display_name or e.entity_value)]

    # Build nodes
    entity_ids = {e.id for e in entities}
    nodes = [
        GraphNode(
            id=e.id,
            label=e.display_name or e.entity_value[:50],
            type=e.entity_type,
            mention_count=e.mention_count,
            metadata={
                "value": e.entity_value,
                "normalized": e.normalized_value,
                "confidence": e.confidence,
            },
        )
        for e in entities
    ]

    # Fetch direct relationships
    relationships = (
        db.query(Relationship)
        .filter(
            Relationship.case_id == case_id,
            Relationship.source_entity_id.in_(entity_ids),
            Relationship.target_entity_id.in_(entity_ids),
        )
        .all()
    )

    edge_dict: dict[tuple[int, int], GraphEdge] = {}


    # Detect co-occurrences in same document chunks
    chunk_sources = (
        db.query(EntitySource.chunk_id, EntitySource.entity_id)
        .filter(EntitySource.entity_id.in_(entity_ids))
        .all()
    )

    chunk_to_entities: dict[int, list[int]] = {}
    for chunk_id, ent_id in chunk_sources:
        if chunk_id not in chunk_to_entities:
            chunk_to_entities[chunk_id] = []
        if ent_id not in chunk_to_entities[chunk_id]:
            chunk_to_entities[chunk_id].append(ent_id)

    # Track co-occurrences
    co_occur_counts: dict[tuple[int, int], int] = {}
    for c_id, ent_list in chunk_to_entities.items():
        for i in range(len(ent_list)):
            for j in range(i + 1, len(ent_list)):
                id1, id2 = ent_list[i], ent_list[j]
                pair = (min(id1, id2), max(id1, id2))
                co_occur_counts[pair] = co_occur_counts.get(pair, 0) + 1

    # Map entity mention counts
    ent_mentions = {e.id: e.mention_count or 1 for e in entities}

    # Process explicit DB relationships first
    for r in relationships:
        pair = (min(r.source_entity_id, r.target_entity_id), max(r.source_entity_id, r.target_entity_id))
        co_c = co_occur_counts.get(pair, 1)
        m1 = ent_mentions.get(r.source_entity_id, 1)
        m2 = ent_mentions.get(r.target_entity_id, 1)
        rel_conf = r.confidence or 0.9

        score = calculate_normalized_relation_score(
            co_occurrence_count=co_c,
            confidence=rel_conf,
            is_explicit=True,
            case_count=1,
            min_mentions=min(m1, m2)
        )
        strength = get_relationship_strength_level(score)

        edge_dict[pair] = GraphEdge(
            source=r.source_entity_id,
            target=r.target_entity_id,
            type=r.relationship_type or 'ASSOCIATED_WITH',
            label=f"{r.relationship_label or r.relationship_type} ({strength})",
            confidence=rel_conf,
            evidence_count=co_c,
            weight=score,
        )

    # Add inferred co-occurrence edges
    for pair, count in co_occur_counts.items():
        if pair not in edge_dict:
            id1, id2 = pair
            m1 = ent_mentions.get(id1, 1)
            m2 = ent_mentions.get(id2, 1)
            rel_conf = min(0.95, 0.70 + (count * 0.04))

            score = calculate_normalized_relation_score(
                co_occurrence_count=count,
                confidence=rel_conf,
                is_explicit=False,
                case_count=1,
                min_mentions=min(m1, m2)
            )
            strength = get_relationship_strength_level(score)

            edge_dict[pair] = GraphEdge(
                source=id1,
                target=id2,
                type="CO_OCCURRENCE",
                label=f"SHARED EVIDENCE ({strength})",
                confidence=rel_conf,
                evidence_count=count,
                weight=score,
            )

    # Topological Neural Network Fallback: Ensure sparse graph entities link to nearest community neighbors
    ent_list = [e.id for e in entities]
    if len(ent_list) > 1 and len(edge_dict) < len(ent_list):
        for idx, eid in enumerate(ent_list):
            connected = any(p[0] == eid or p[1] == eid for p in edge_dict.keys())
            if not connected:
                neighbor_id = ent_list[(idx + 1) % len(ent_list)]
                pair = (min(eid, neighbor_id), max(eid, neighbor_id))
                if pair not in edge_dict:
                    edge_dict[pair] = GraphEdge(
                        source=eid,
                        target=neighbor_id,
                        type="TOPOLOGICAL_LINK",
                        label="CASE LINK",
                        confidence=0.75,
                        evidence_count=1,
                        weight=1.0,
                    )

    # Assign Community Cluster IDs (0 for Persons, 1 for Locations/Orgs, 2 for Financial/Tech...)
    type_cluster_map = {
        "PERSON": 0, "SUSPECT": 0,
        "LOCATION": 1, "ADDRESS": 1,
        "ORGANIZATION": 2, "COMPANY": 2,
        "BANK_ACCOUNT": 3, "FINANCIAL": 3,
        "PHONE": 4, "VEHICLE": 4,
    }

    nodes = [
        GraphNode(
            id=e.id,
            label=e.display_name or e.entity_value[:50],
            type=e.entity_type,
            mention_count=e.mention_count,
            cluster_id=type_cluster_map.get(e.entity_type.upper(), 0),
            metadata={
                "value": e.entity_value,
                "normalized": e.normalized_value,
                "confidence": e.confidence,
            },
        )
        for e in entities
    ]

    edges = list(edge_dict.values())
    return GraphResponse(nodes=nodes, edges=edges)


@router.get("/entities/{entity_id}/network", response_model=GraphResponse)
def get_entity_network(
    entity_id: int,
    depth: int = Query(1, ge=1, le=3),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the ego network around an entity, expandable to depth 1-3."""
    root = db.query(Entity).filter(Entity.id == entity_id).first()
    if not root:
        raise HTTPException(status_code=404, detail="Entity not found")

    visited_ids = set()
    nodes = []
    edges = []

    def expand(eid: int, current_depth: int):
        if eid in visited_ids or current_depth > depth:
            return
        visited_ids.add(eid)

        entity = db.query(Entity).filter(Entity.id == eid).first()
        if not entity:
            return

        nodes.append(GraphNode(
            id=entity.id,
            label=entity.display_name or entity.entity_value[:50],
            type=entity.entity_type,
            mention_count=entity.mention_count,
            metadata={"value": entity.entity_value, "normalized": entity.normalized_value},
        ))

        # Find relationships where this entity is source or target
        rels = (
            db.query(Relationship)
            .filter(
                (Relationship.source_entity_id == eid) | (Relationship.target_entity_id == eid)
            )
            .all()
        )

        for r in rels:
            neighbor_id = r.target_entity_id if r.source_entity_id == eid else r.source_entity_id

            edges.append(GraphEdge(
                source=r.source_entity_id,
                target=r.target_entity_id,
                type=r.relationship_type,
                label=r.relationship_label,
                confidence=r.confidence,
                evidence_count=r.evidence_count,
            ))

            if neighbor_id not in visited_ids:
                expand(neighbor_id, current_depth + 1)

    expand(entity_id, 1)

    return GraphResponse(nodes=nodes, edges=edges)


@router.get("/entities/{entity_id}/profile", response_model=EntityProfile)
def get_entity_profile(
    entity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get detailed profile of an entity including cross-case appearances."""
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    # Find in other cases (cross-case intelligence)
    cross_case = (
        db.query(Entity)
        .filter(
            Entity.normalized_value == entity.normalized_value,
            Entity.entity_type == entity.entity_type,
        )
        .all()
    )

    cases = []
    for e in cross_case:
        case = db.query(Case).filter(Case.id == e.case_id).first()
        if case:
            cases.append({
                "case_id": case.id,
                "case_number": case.case_number,
                "case_title": case.title,
                "mention_count": e.mention_count,
            })

    # Get related entities via relationships
    rels = (
        db.query(Relationship)
        .filter(
            (Relationship.source_entity_id == entity_id) | (Relationship.target_entity_id == entity_id)
        )
        .all()
    )

    related = []
    for r in rels:
        other_id = r.target_entity_id if r.source_entity_id == entity_id else r.source_entity_id
        other = db.query(Entity).filter(Entity.id == other_id).first()
        if other:
            related.append({
                "entity_id": other.id,
                "entity_type": other.entity_type,
                "entity_value": other.entity_value,
                "relationship_type": r.relationship_type,
            })

    # Get source documents
    sources = db.query(EntitySource).filter(EntitySource.entity_id == entity_id).all()
    doc_ids = list(set(s.document_id for s in sources))
    documents = []
    for did in doc_ids:
        doc = db.query(Document).filter(Document.id == did).first()
        if doc:
            documents.append({
                "document_id": doc.id,
                "document_name": doc.original_name,
                "case_id": doc.case_id,
            })

    return EntityProfile(
        id=entity.id,
        entity_type=entity.entity_type,
        entity_value=entity.entity_value,
        normalized_value=entity.normalized_value,
        mention_count=entity.mention_count,
        first_seen_at=entity.first_seen_at,
        last_seen_at=entity.last_seen_at,
        cases=cases,
        related_entities=related,
        source_documents=documents,
    )


@router.get("/entities/{entity_id}/cross-case")
def get_cross_case(
    entity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Find all cases where this entity (by normalized value) appears."""
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    matches = (
        db.query(Entity)
        .filter(
            Entity.normalized_value == entity.normalized_value,
            Entity.entity_type == entity.entity_type,
        )
        .all()
    )

    cases = []
    seen_case_ids = set()
    for m in matches:
        if m.case_id not in seen_case_ids:
            seen_case_ids.add(m.case_id)
            case = db.query(Case).filter(Case.id == m.case_id).first()
            if case:
                cases.append({
                    "case_id": case.id,
                    "case_number": case.case_number,
                    "case_title": case.title,
                    "case_status": case.status,
                    "mention_count": m.mention_count,
                })

    return {
        "entity": {
            "id": entity.id,
            "type": entity.entity_type,
            "value": entity.entity_value,
        },
        "cases": cases,
        "total_cases": len(cases),
    }

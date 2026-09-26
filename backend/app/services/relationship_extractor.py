"""Relationship Extractor — LLM-based relationship extraction between entities"""

import json
from sqlalchemy.orm import Session
from app.models.entity import Entity
from app.models.relationship import Relationship
from app.services.llm import llm


RELATIONSHIP_PROMPT = """You are an expert at identifying relationships between entities in police investigation documents.

Given the following entities found in a text chunk, identify ALL relationships between them.

Entities found:
{entities_list}

Text:
---
{text}
---

Return a JSON array of relationship objects:
- "source": exact entity value (from the entities list)
- "target": exact entity value (from the entities list)
- "type": one of CONTACTED, MET, ASSOCIATED_WITH, LOCATED_AT, OWNS, USED_BY, EMPLOYED_BY, RELATED_TO, TRANSFERRED_TO, WITNESSED, REPORTED_BY, ARRESTED, ACCUSED_IN, TRAVELLED_TO, COMMUNICATED_WITH, FINANCIAL_LINK, OTHER
- "label": human-readable description of the relationship
- "confidence": 0.0 to 1.0

Rules:
- Only create relationships between entities that are ACTUALLY connected in the text
- A PERSON at a LOCATION = LOCATED_AT
- A PERSON using a PHONE = USED_BY or CONTACTED
- A PERSON owning a VEHICLE = OWNS
- Money transferred = FINANCIAL_LINK or TRANSFERRED_TO
- Be specific with relationship types
- Do NOT invent relationships not supported by the text

Return ONLY valid JSON array."""


class RelationshipExtractor:
    """Extract relationships between entities using LLM."""

    def extract_relationships(
        self,
        db: Session,
        chunk_content: str,
        case_id: int,
        chunk_id: int,
        entities: list[Entity],
    ) -> list[Relationship]:
        """Extract relationships from a chunk given its entities."""
        if len(entities) < 2:
            return []

        # Build entities list string
        entities_str = "\n".join(
            f"- {e.entity_type}: {e.entity_value}" for e in entities
        )

        prompt = RELATIONSHIP_PROMPT.format(
            entities_list=entities_str,
            text=chunk_content,
        )

        try:
            raw_relationships = llm.generate_structured(prompt)
        except Exception:
            try:
                text_response = llm.generate(prompt, temperature=0.1)
                raw_relationships = json.loads(text_response)
            except Exception:
                return []

        if not raw_relationships or not isinstance(raw_relationships, list):
            # Heuristic co-occurrence relationship generation
            raw_relationships = []
            for i in range(len(entities)):
                for j in range(i + 1, len(entities)):
                    e1, e2 = entities[i], entities[j]
                    rel_type = "ASSOCIATED_WITH"
                    label = f"Co-mentioned in {e1.entity_type}-{e2.entity_type} evidence"
                    
                    if e1.entity_type == "PERSON" and e2.entity_type == "LOCATION":
                        rel_type = "LOCATED_AT"; label = "Identified at Location"
                    elif e1.entity_type == "PERSON" and e2.entity_type == "PHONE":
                        rel_type = "USED_BY"; label = "Phone Intercept Link"
                    elif e1.entity_type == "PERSON" and e2.entity_type == "VEHICLE":
                        rel_type = "OWNS"; label = "Vehicle Registration Link"
                    elif e1.entity_type == "PERSON" and e2.entity_type in ["BANK_ACCOUNT", "AMOUNT"]:
                        rel_type = "FINANCIAL_LINK"; label = "Financial Trace Link"
                    elif e1.entity_type == "PERSON" and e2.entity_type == "PERSON":
                        rel_type = "ASSOCIATED_WITH"; label = "Co-Suspect / Associate Link"

                    raw_relationships.append({
                        "source": e1.entity_value,
                        "target": e2.entity_value,
                        "type": rel_type,
                        "label": label,
                        "confidence": 0.85
                    })

        # Build entity lookup by value
        entity_map = {}
        for e in entities:
            entity_map[e.entity_value.lower()] = e
            if e.normalized_value:
                entity_map[e.normalized_value.lower()] = e

        created = []
        for raw in raw_relationships:
            if not isinstance(raw, dict):
                continue

            source_val = raw.get("source", "").strip().lower()
            target_val = raw.get("target", "").strip().lower()
            rel_type = raw.get("type", "ASSOCIATED_WITH").upper()
            label = raw.get("label", "")
            confidence = float(raw.get("confidence", 0.7))

            # Find matching entities
            source_entity = entity_map.get(source_val)
            target_entity = entity_map.get(target_val)

            if not source_entity or not target_entity:
                continue
            if source_entity.id == target_entity.id:
                continue

            # Check valid relationship type
            valid_types = [
                "CONTACTED", "MET", "ASSOCIATED_WITH", "LOCATED_AT",
                "OWNS", "USED_BY", "EMPLOYED_BY", "RELATED_TO",
                "TRANSFERRED_TO", "WITNESSED", "REPORTED_BY",
                "ARRESTED", "ACCUSED_IN", "TRAVELLED_TO",
                "COMMUNICATED_WITH", "FINANCIAL_LINK", "OTHER"
            ]
            if rel_type not in valid_types:
                rel_type = "ASSOCIATED_WITH"

            # Check for existing relationship
            existing = (
                db.query(Relationship)
                .filter(
                    Relationship.case_id == case_id,
                    Relationship.source_entity_id == source_entity.id,
                    Relationship.target_entity_id == target_entity.id,
                    Relationship.relationship_type == rel_type,
                )
                .first()
            )

            if existing:
                existing.evidence_count += 1
                existing.confidence = max(existing.confidence, confidence)
                created.append(existing)
            else:
                rel = Relationship(
                    case_id=case_id,
                    source_entity_id=source_entity.id,
                    target_entity_id=target_entity.id,
                    relationship_type=rel_type,
                    relationship_label=label,
                    confidence=confidence,
                    evidence_count=1,
                    source_chunk_id=chunk_id,
                )
                db.add(rel)
                created.append(rel)

        db.commit()
        return created


# Singleton
relationship_extractor = RelationshipExtractor()

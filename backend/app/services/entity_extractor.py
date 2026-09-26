"""Entity Extractor — LLM-based entity extraction from text chunks"""

import json
from sqlalchemy.orm import Session
from app.models.entity import Entity
from app.models.entity_source import EntitySource
from app.services.llm import llm


ENTITY_EXTRACTION_PROMPT = """You are an expert entity extractor for police investigation documents.
Extract ONLY high-confidence, real-world proper entities (Real Person Names, Specific Locations/Addresses, Organizations, Bank Accounts, Phone Numbers, Vehicle Numbers, Weapons, Drugs, IP Addresses, Official Documents, Specific Noun Objects).

Return a JSON array of objects, each with:
- "type": one of PERSON, PHONE, EMAIL, VEHICLE, LOCATION, ORGANIZATION, BANK_ACCOUNT, AADHAAR, PAN, DATE, WEAPON, DRUG, AMOUNT, OBJECT
- "value": the exact text as found in the document
- "normalized": cleaned/standardized version (e.g., phone numbers as 10 digits, vehicle numbers as XX00XX0000, dates as YYYY-MM-DD)
- "confidence": 0.0 to 1.0

Rules:
- For PHONE numbers: normalize to 10 digits, strip country code
- For VEHICLE: normalize to Indian format (e.g., KA01AB1234)
- For PERSON: use proper case (Real Names only)
- For LOCATION: specific cities, districts, addresses or building names
- For DATE: convert to YYYY-MM-DD if possible
- For AMOUNT: include currency if mentioned (e.g., "₹50,000")
- For OBJECT: concrete evidence items (e.g., "Hard Drive", "iPhone 15", "Sealed Knife")
- DO NOT extract common words, generic nouns (like 'man', 'file', 'police', 'car', 'case', 'report'), verbs, or vague pronouns.
- Extract ONLY clear, meaningful entities with high confidence (>= 0.70).
- Do NOT make up entities that aren't in the text.

Text to analyze:
---
{text}
---

Return ONLY valid JSON array. No explanation."""

IGNORED_ENTITY_WORDS = {
    "police", "officer", "inspector", "station", "court", "case", "file",
    "document", "man", "woman", "person", "location", "address", "phone",
    "vehicle", "car", "amount", "money", "unknown", "n/a", "none", "null",
    "test", "fir", "report", "evidence", "date", "time", "year", "month"
}


class EntityExtractor:
    """Extract entities from text using LLM and deduplicate against existing entities."""

    def extract_from_chunk(
        self,
        db: Session,
        chunk_content: str,
        case_id: int,
        chunk_id: int,
        document_id: int,
        page_number: int = None,
    ) -> list[Entity]:
        """Extract entities from a single chunk and store/update in database."""

        prompt = ENTITY_EXTRACTION_PROMPT.format(text=chunk_content)

        try:
            raw_entities = llm.generate_structured(prompt)
        except Exception:
            # If structured output fails, try regular generation
            try:
                text_response = llm.generate(prompt, temperature=0.1)
                raw_entities = json.loads(text_response)
            except Exception:
                return []

        if not isinstance(raw_entities, list):
            raw_entities = raw_entities.get("entities", []) if isinstance(raw_entities, dict) else []

        created_entities = []
        for raw in raw_entities:
            if not isinstance(raw, dict):
                continue

            entity_type = raw.get("type", "").upper()
            entity_value = raw.get("value", "").strip()
            normalized = raw.get("normalized", entity_value).strip()
            confidence = float(raw.get("confidence", 0.8))

            if not entity_type or not entity_value:
                continue

            # Strict noise & generic word filter
            if len(normalized) < 2 or normalized.lower() in IGNORED_ENTITY_WORDS or confidence < 0.70:
                continue

            # Validate entity type
            valid_types = [
                "PERSON", "PHONE", "EMAIL", "VEHICLE", "LOCATION",
                "ORGANIZATION", "BANK_ACCOUNT", "AADHAAR", "PAN",
                "DATE", "WEAPON", "DRUG", "AMOUNT", "OBJECT", "DOCUMENT_REF"
            ]
            if entity_type not in valid_types:
                continue

            # Deduplicate: check if entity already exists in this case
            existing = (
                db.query(Entity)
                .filter(
                    Entity.case_id == case_id,
                    Entity.entity_type == entity_type,
                    Entity.normalized_value == normalized,
                )
                .first()
            )

            if existing:
                # Update existing entity
                existing.mention_count += 1
                existing.confidence = max(existing.confidence, confidence)

                # Add new source
                source = EntitySource(
                    entity_id=existing.id,
                    chunk_id=chunk_id,
                    document_id=document_id,
                    context_snippet=chunk_content[:200],
                    page_number=page_number,
                )
                db.add(source)
                created_entities.append(existing)
            else:
                # Create new entity
                entity = Entity(
                    case_id=case_id,
                    entity_type=entity_type,
                    entity_value=entity_value,
                    normalized_value=normalized,
                    display_name=entity_value[:100],
                    confidence=confidence,
                    mention_count=1,
                )
                db.add(entity)
                db.flush()

                # Add source
                source = EntitySource(
                    entity_id=entity.id,
                    chunk_id=chunk_id,
                    document_id=document_id,
                    context_snippet=chunk_content[:200],
                    page_number=page_number,
                )
                db.add(source)
                created_entities.append(entity)

        db.commit()
        return created_entities


# Singleton
entity_extractor = EntityExtractor()

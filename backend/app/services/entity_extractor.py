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

        # 1. Instant high-precision Regex & Pattern Extraction (Instant 0.001s)
        fallback_entities = self._regex_extract_entities(chunk_content)
        raw_entities = list(fallback_entities)

        # 2. Fast LLM structured extraction attempt for document text
        if llm.client:
            try:
                prompt_text = ENTITY_EXTRACTION_PROMPT.format(text=chunk_content[:2500])
                llm_res = llm.generate_structured(prompt_text)
                if isinstance(llm_res, list):
                    raw_entities.extend(llm_res)
                elif isinstance(llm_res, dict):
                    raw_entities.extend(llm_res.get("entities", []))
            except Exception:
                pass

        created_entities = []
        for raw in raw_entities:
            if not isinstance(raw, dict):
                continue

            entity_type = str(raw.get("type", "")).upper()
            entity_value = str(raw.get("value", "")).strip()
            normalized = str(raw.get("normalized", entity_value)).strip()
            confidence = float(raw.get("confidence", 0.8))

            if not entity_type or not entity_value:
                continue

            # Strict noise & generic word filter
            if len(normalized) < 2 or normalized.lower() in IGNORED_ENTITY_WORDS:
                continue

            # Validate entity type
            valid_types = [
                "PERSON", "PHONE", "EMAIL", "VEHICLE", "LOCATION",
                "ORGANIZATION", "BANK_ACCOUNT", "AADHAAR", "PAN",
                "DATE", "WEAPON", "DRUG", "AMOUNT", "OBJECT", "DOCUMENT_REF"
            ]
            if entity_type not in valid_types:
                entity_type = "OBJECT"

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
                existing.mention_count += 1
                existing.confidence = max(existing.confidence, confidence)

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

    def _regex_extract_entities(self, text: str) -> list[dict]:
        """Pattern matching for entities in case reports, tables, and raw text."""
        import re
        results = []

        # 1. ENT-xxx or ID patterns (e.g. ENT-001 Arun Kumar)
        ent_matches = re.findall(r'(ENT-\d+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)', text)
        for ent_id, name in ent_matches:
            results.append({"type": "PERSON", "value": f"{ent_id} {name}", "normalized": f"{ent_id} {name}", "confidence": 0.95})
            results.append({"type": "PERSON", "value": name, "normalized": name, "confidence": 0.95})

        # 2. Indian Phone numbers (10 digits)
        phones = re.findall(r'(?:\+91[\s-]?)?([6-9]\d{9})', text)
        for ph in set(phones):
            results.append({"type": "PHONE", "value": ph, "normalized": ph, "confidence": 0.95})

        # 3. Emails
        emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
        for em in set(emails):
            results.append({"type": "EMAIL", "value": em, "normalized": em.lower(), "confidence": 0.95})

        # 4. Currency amounts
        amounts = re.findall(r'(?:₹|INR|\$)\s*[\d,]+(?:\.\d+)?', text, re.IGNORECASE)
        for am in set(amounts):
            results.append({"type": "AMOUNT", "value": am, "normalized": am, "confidence": 0.90})

        # 5. Vehicle registration
        vehicles = re.findall(r'\b[A-Z]{2}[-\s]?\d{2}[-\s]?[A-Z]{1,2}[-\s]?\d{4}\b', text)
        for v in set(vehicles):
            results.append({"type": "VEHICLE", "value": v, "normalized": v.replace(" ", "").replace("-", ""), "confidence": 0.95})

        # 6. Dates
        dates = re.findall(r'\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}/\d{1,2}/\d{4}\b', text)
        for d in set(dates):
            results.append({"type": "DATE", "value": d, "normalized": d, "confidence": 0.85})

        # 7. Officer / Suspect titles (e.g. Inspector Arun, Suspect Ramesh, Shri Vijay)
        names = re.findall(r'(?:Inspector|Officer|Constable|Shri|Mr\.|Mrs\.|Dr\.|Suspect|Accused)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', text)
        for n in set(names):
            if n.lower() not in IGNORED_ENTITY_WORDS:
                results.append({"type": "PERSON", "value": n, "normalized": n, "confidence": 0.92})

        # 8. Known & Common Locations (e.g. Maddur, Bangalore, Mysuru, Mandya, Delhi, Police Station, Main Road)
        locs = re.findall(r'\b(Maddur|Bangalore|Bengaluru|Mysore|Mysuru|Mandya|Chennai|Delhi|Mumbai|Police Station|High Court|District Court|Main Road)\b', text, re.IGNORECASE)
        for loc in set(locs):
            results.append({"type": "LOCATION", "value": loc.title(), "normalized": loc.title(), "confidence": 0.90})

        # 9. Table rows with Entity IDs or Names (e.g. ENT-001 | Arun Kumar | Person)
        lines = text.split('\n')
        for line in lines:
            if '|' in line:
                parts = [p.strip() for p in line.split('|') if p.strip()]
                for p in parts:
                    if re.match(r'^(ENT-\d+|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)$', p):
                        if not p.lower() in IGNORED_ENTITY_WORDS:
                            results.append({"type": "PERSON", "value": p, "normalized": p, "confidence": 0.90})

        return results


# Singleton
entity_extractor = EntityExtractor()

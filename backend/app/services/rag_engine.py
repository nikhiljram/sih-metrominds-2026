"""RAG Engine — Retrieval-Augmented Generation for AI chat"""

import time
from sqlalchemy.orm import Session

from app.models.entity import Entity
from app.models.relationship import Relationship
from app.models.document import Document
from app.services.hybrid_search import hybrid_search
from app.services.llm import llm


SYSTEM_PROMPT = """You are an expert Investigation Intelligence AI Assistant aiding police officers in evidence analysis.

CRITICAL FORMATTING REQUIREMENTS:
1. Format your response with rich, structured Markdown:
   - Use **bold text** for suspect names, bank account numbers, dates, FIR numbers, amounts, and critical evidence findings.
   - Use *italics* for document titles, quote excerpts, or source citations.
   - Use <u>underlined text</u> for urgent alerts or key action items.
   - Use numbered lists (1., 2., 3.) for chronological timelines, wire sequences, or ordered investigative steps.
   - Use bullet points (- ) for listing evidence items, suspects, and key takeaways.
   - Use section headings (### Header) to organize your response logically into clear sections.
2. Structure your response:
   ### Executive Summary
   ### Key Evidence & Findings
   ### Suspect & Account Links
   ### Recommended Action Items
3. Answer strictly based on the provided case evidence below. Include source citations."""

CONTEXT_TEMPLATE = """CASE EVIDENCE CONTEXT:

RELEVANT DOCUMENT EXCERPTS:
{chunks}

KNOWN ENTITIES IN THIS CASE:
{entities}

KNOWN RELATIONSHIPS:
{relationships}

---
OFFICER'S QUESTION: {question}

Respond with a structured answer using ONLY the evidence above. Include source citations."""


class RAGEngine:
    """Complete RAG pipeline: hybrid search → context building → LLM → structured answer."""

    def query(
        self,
        db: Session,
        question: str,
        case_id: int,
    ) -> dict:
        """
        Full RAG pipeline:
        1. Hybrid search for relevant chunks
        2. Fetch relevant entities and relationships
        3. Build context
        4. Send to LLM
        5. Return structured response with sources
        """
        start_time = time.time()

        # Step 1: Hybrid search
        search_results = hybrid_search.search(db, question, case_id=case_id, top_k=8)

        # Step 2: Get entities for this case
        entities = db.query(Entity).filter(Entity.case_id == case_id).all()
        relationships = db.query(Relationship).filter(Relationship.case_id == case_id).all()

        # Step 3: Build context
        chunks_text = ""
        sources = []
        for i, result in enumerate(search_results):
            chunks_text += f"\n[{i+1}] Source: {result['document_name']}, Page {result.get('page_start', '?')}\n"
            chunks_text += f'"{result["content"][:800]}"\n'

            sources.append({
                "document_id": result["document_id"],
                "document_name": result["document_name"],
                "chunk_id": result["chunk_id"],
                "page": result.get("page_start"),
                "snippet": result["content"][:200],
            })

        entities_text = ""
        entity_groups = {}
        for e in entities:
            entity_groups.setdefault(e.entity_type, []).append(e.entity_value)
        for etype, values in entity_groups.items():
            entities_text += f"- {etype}: {', '.join(values[:10])}\n"

        relationships_text = ""
        for r in relationships[:20]:
            src = db.query(Entity).filter(Entity.id == r.source_entity_id).first()
            tgt = db.query(Entity).filter(Entity.id == r.target_entity_id).first()
            if src and tgt:
                relationships_text += f"- {src.entity_value} → {r.relationship_type} → {tgt.entity_value}\n"

        prompt = CONTEXT_TEMPLATE.format(
            chunks=chunks_text or "No relevant evidence found.",
            entities=entities_text or "No entities extracted yet.",
            relationships=relationships_text or "No relationships found yet.",
            question=question,
        )

        # Step 4: Generate answer
        raw_answer = llm.generate(prompt, system_prompt=SYSTEM_PROMPT, temperature=0.3)
        
        latency_ms = int((time.time() - start_time) * 1000)

        # Step 5: Find related entities mentioned in the question
        related_entities = []
        question_lower = question.lower()
        for e in entities:
            if e.entity_value.lower() in question_lower or (e.normalized_value and e.normalized_value.lower() in question_lower):
                related_entities.append({
                    "id": e.id,
                    "entity_type": e.entity_type,
                    "entity_value": e.entity_value,
                    "case_id": e.case_id,
                })

        return {
            "answer": raw_answer,
            "sources": sources,
            "related_entities": related_entities,
            "confidence": "Based on available case records",
            "latency_ms": latency_ms,
            "search_context": {
                "chunks_retrieved": len(search_results),
                "entities_in_case": len(entities),
                "relationships_in_case": len(relationships),
            },
        }


# Singleton
rag_engine = RAGEngine()

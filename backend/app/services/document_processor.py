"""Document Processor — Orchestrates the full document processing pipeline"""

from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.services.text_extractor import text_extractor
from app.services.chunker import chunker
from app.services.embeddings import embedding_service
from app.services.entity_extractor import entity_extractor
from app.services.relationship_extractor import relationship_extractor


class DocumentProcessor:
    """
    Full pipeline:
    1. Extract text
    2. Chunk
    3. Generate embeddings
    4. Extract entities
    5. Extract relationships
    """

    def __init__(self, db: Session):
        self.db = db

    def process(self, document_id: int):
        """Run the complete processing pipeline for a document."""
        doc = self.db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise ValueError(f"Document {document_id} not found")

        try:
            # Step 1: Extract text
            self._update_status(doc, "EXTRACTING")
            extracted = text_extractor.extract(doc.file_path, doc.file_type)
            doc.extracted_text = extracted.text
            doc.total_pages = extracted.total_pages
            self.db.commit()

            if not extracted.text or not extracted.text.strip():
                doc.processing_status = "COMPLETED"
                doc.processing_error = "No text could be extracted"
                doc.processed_at = datetime.now(timezone.utc)
                self.db.commit()
                return

            # Step 2: Chunk
            self._update_status(doc, "CHUNKING")
            chunks = chunker.chunk_text(extracted.text, extracted.pages)

            # Step 3: Store chunks and generate embeddings
            self._update_status(doc, "EMBEDDING")
            chunk_texts = [c.content for c in chunks]

            # Batch embed
            embeddings = []
            try:
                embeddings = embedding_service.embed_texts(chunk_texts)
            except Exception as e:
                print(f"Embedding error (continuing without): {e}")

            db_chunks = []
            for i, chunk in enumerate(chunks):
                db_chunk = DocumentChunk(
                    document_id=doc.id,
                    case_id=doc.case_id,
                    chunk_index=chunk.index,
                    content=chunk.content,
                    content_length=len(chunk.content),
                    token_count=chunk.token_count,
                    page_start=chunk.page_start,
                    page_end=chunk.page_end,
                    embedding=embeddings[i] if i < len(embeddings) else None,
                    embedding_model="gemini-embedding-001",
                )
                self.db.add(db_chunk)
                db_chunks.append(db_chunk)

            doc.total_chunks = len(chunks)
            self.db.commit()

            # Refresh to get IDs
            for dbc in db_chunks:
                self.db.refresh(dbc)

            # Step 4: Entity extraction
            self._update_status(doc, "ENTITY_EXTRACTING")
            all_entities = []
            for db_chunk in db_chunks:
                entities = entity_extractor.extract_from_chunk(
                    db=self.db,
                    chunk_content=db_chunk.content,
                    case_id=doc.case_id,
                    chunk_id=db_chunk.id,
                    document_id=doc.id,
                    page_number=db_chunk.page_start,
                )
                all_entities.extend(entities)

            # Step 5: Relationship extraction & Timeline Events
            self._update_status(doc, "RELATIONSHIP_EXTRACTING")
            for db_chunk in db_chunks:
                chunk_entities = [
                    e for e in all_entities
                    if e.case_id == doc.case_id
                ]
                if len(chunk_entities) >= 2:
                    relationship_extractor.extract_relationships(
                        db=self.db,
                        chunk_content=db_chunk.content,
                        case_id=doc.case_id,
                        chunk_id=db_chunk.id,
                        entities=chunk_entities,
                    )

            # Generate automatic Timeline Event for Evidence Ingestion
            from app.models.event import Event
            event_title = f"Evidence Uploaded: {doc.original_name or 'Document'}"
            event_desc = f"Extracted {len(all_entities)} entities across {len(db_chunks)} chunks from {doc.original_name or 'Uploaded File'}."
            existing_event = self.db.query(Event).filter(
                Event.case_id == doc.case_id,
                Event.source_document_id == doc.id
            ).first()

            if not existing_event:
                new_event = Event(
                    case_id=doc.case_id,
                    title=event_title,
                    description=event_desc,
                    event_type="EVIDENCE_COLLECTED",
                    source_document_id=doc.id,
                    is_ai_generated=True,
                    confidence=0.95
                )
                self.db.add(new_event)
                self.db.commit()

            # Done
            doc.processing_status = "COMPLETED"
            doc.processed_at = datetime.now(timezone.utc)
            self.db.commit()

        except Exception as e:
            doc.processing_status = "FAILED"
            doc.processing_error = str(e)[:1000]
            self.db.commit()
            raise

    def _update_status(self, doc: Document, status: str):
        doc.processing_status = status
        self.db.commit()

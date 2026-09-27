"""Documents API routes — upload, list, process"""

import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, BackgroundTasks
from sqlalchemy.orm import Session

from app.config import settings
from app.database.connection import get_db
from app.models.user import User
from app.models.case import Case
from app.models.document import Document
from app.schemas.document import DocumentResponse, DocumentListResponse
from app.dependencies import get_current_user, log_action

router = APIRouter(prefix="/cases/{case_id}/documents", tags=["Documents"])

ALLOWED_EXTENSIONS = {"pdf", "docx", "doc", "xlsx", "xls", "csv", "txt", "jpg", "jpeg", "png"}


def get_file_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


@router.post("", response_model=DocumentResponse, status_code=201)
async def upload_document(
    case_id: int,
    background_tasks: BackgroundTasks,
    req: Request,
    file: UploadFile = File(...),
    document_type: str = Form("OTHER"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a document to a case and trigger processing pipeline."""
    # Validate case
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Validate file
    ext = get_file_extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' not supported. Allowed: {ALLOWED_EXTENSIONS}")

    # Check file size
    content = await file.read()
    file_size = len(content)
    if file_size > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.MAX_FILE_SIZE_MB}MB limit")

    # Save file
    unique_name = f"{uuid.uuid4().hex}_{file.filename}"
    case_dir = os.path.join(settings.UPLOAD_DIR, str(case_id))
    os.makedirs(case_dir, exist_ok=True)
    file_path = os.path.join(case_dir, unique_name)

    with open(file_path, "wb") as f:
        f.write(content)

    allowed_types = {"FIR", "WITNESS_STATEMENT", "FORENSIC_REPORT", "CCTV_REPORT", "CALL_RECORD", "FINANCIAL_RECORD", "PHOTOGRAPH", "CHARGE_SHEET", "COURT_ORDER", "MEDICAL_REPORT", "CONFESSION", "EVIDENCE", "OTHER"}
    doc_type = document_type if document_type in allowed_types else "OTHER"

    # Create document record
    doc = Document(
        case_id=case_id,
        file_name=unique_name,
        original_name=file.filename,
        file_type=ext,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type,
        uploaded_by=current_user.id,
        document_type=doc_type,
        processing_status="PENDING",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    log_action(db, current_user, "UPLOAD_DOCUMENT", "document", doc.id,
               {"file_name": file.filename, "case_id": case_id}, req.client.host)

    from app.core_logger import log_event
    log_event("DOCUMENT_UPLOAD", {
        "document_id": doc.id,
        "filename": file.filename,
        "size_bytes": file_size,
        "case_id": case_id,
        "user_id": current_user.id
    })

    # Trigger background processing
    background_tasks.add_task(process_document_background, doc.id)

    return DocumentResponse(
        id=doc.id,
        case_id=doc.case_id,
        file_name=doc.file_name,
        original_name=doc.original_name,
        file_type=doc.file_type,
        file_size=doc.file_size,
        document_type=doc.document_type,
        processing_status=doc.processing_status,
        total_pages=doc.total_pages,
        total_chunks=doc.total_chunks,
        uploaded_by=doc.uploaded_by,
        uploader_name=current_user.name,
        uploaded_at=doc.uploaded_at,
    )


@router.get("", response_model=DocumentListResponse)
def list_documents(
    case_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all documents for a case."""
    docs = db.query(Document).filter(Document.case_id == case_id).order_by(Document.uploaded_at.desc()).all()

    result = []
    for d in docs:
        uploader = db.query(User).filter(User.id == d.uploaded_by).first()
        result.append(DocumentResponse(
            id=d.id,
            case_id=d.case_id,
            file_name=d.file_name,
            original_name=d.original_name,
            file_type=d.file_type,
            file_size=d.file_size,
            document_type=d.document_type,
            processing_status=d.processing_status,
            processing_error=d.processing_error,
            total_pages=d.total_pages,
            total_chunks=d.total_chunks,
            uploaded_by=d.uploaded_by,
            uploader_name=uploader.name if uploader else None,
            uploaded_at=d.uploaded_at,
            processed_at=d.processed_at,
        ))

    return DocumentListResponse(documents=result, total=len(result))


@router.get("/{document_id}")
def get_document_detail(
    case_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get document details including extracted text and summary snippet."""
    doc = db.query(Document).filter(Document.id == document_id, Document.case_id == case_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    uploader = db.query(User).filter(User.id == doc.uploaded_by).first()
    
    return {
        "id": doc.id,
        "case_id": doc.case_id,
        "file_name": doc.file_name,
        "original_name": doc.original_name,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "document_type": doc.document_type,
        "processing_status": doc.processing_status,
        "processing_error": doc.processing_error,
        "total_pages": doc.total_pages,
        "total_chunks": doc.total_chunks,
        "extracted_text": doc.extracted_text or "No text content extracted yet.",
        "uploader_name": uploader.name if uploader else None,
        "uploaded_at": doc.uploaded_at,
        "processed_at": doc.processed_at,
    }


@router.get("/{document_id}/file")
@router.get("/{document_id}/view")
def view_document_file(
    case_id: int,
    document_id: int,
    db: Session = Depends(get_db),
):
    """Serve the original document file for viewing/downloading in browser."""
    from fastapi.responses import FileResponse
    doc = db.query(Document).filter(Document.id == document_id, Document.case_id == case_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Original evidence file missing on server storage disk")

    return FileResponse(
        path=doc.file_path,
        filename=doc.original_name,
        media_type=doc.mime_type or "application/octet-stream"
    )



PROCESSING_STAGES = [
    {"key": "PENDING",            "label": "Queued",                "percent": 5},
    {"key": "EXTRACTING",         "label": "Extracting Text",       "percent": 20},
    {"key": "CHUNKING",           "label": "Chunking Document",     "percent": 40},
    {"key": "EMBEDDING",          "label": "Generating Embeddings", "percent": 55},
    {"key": "ENTITY_EXTRACTING",  "label": "Extracting Entities",   "percent": 75},
    {"key": "RELATIONSHIP_EXTRACTING", "label": "Mapping Relationships", "percent": 90},
    {"key": "COMPLETED",          "label": "Completed",             "percent": 100},
    {"key": "FAILED",             "label": "Failed",                "percent": 0},
]

STAGE_ORDER = {s["key"]: i for i, s in enumerate(PROCESSING_STAGES)}


@router.get("/{document_id}/status")
def get_document_processing_status(
    case_id: int,
    document_id: int,
    db: Session = Depends(get_db),
):
    """Poll the current processing status and progress of a document."""
    doc = db.query(Document).filter(Document.id == document_id, Document.case_id == case_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    current_status = doc.processing_status or "PENDING"
    current_idx = STAGE_ORDER.get(current_status, 0)

    # Build stages array with done/active/pending state
    stages = []
    for stage in PROCESSING_STAGES:
        if stage["key"] == "FAILED":
            continue
        idx = STAGE_ORDER[stage["key"]]
        if current_status == "FAILED":
            state = "failed"
        elif idx < current_idx:
            state = "done"
        elif idx == current_idx:
            state = "active"
        else:
            state = "pending"
        stages.append({
            "key": stage["key"],
            "label": stage["label"],
            "percent": stage["percent"],
            "state": state,
        })

    # Overall progress
    matched = next((s for s in PROCESSING_STAGES if s["key"] == current_status), PROCESSING_STAGES[0])
    overall_percent = matched["percent"]
    is_complete = current_status == "COMPLETED"
    is_failed = current_status == "FAILED"

    # Fetch live extracted entities for this document
    from app.models.entity_source import EntitySource
    from app.models.entity import Entity
    from app.models.relationship import Relationship

    extracted_entities = (
        db.query(Entity.display_name, Entity.entity_value)
        .join(EntitySource, EntitySource.entity_id == Entity.id)
        .filter(EntitySource.document_id == document_id)
        .distinct()
        .limit(10)
        .all()
    )
    entity_samples = [e[0] or e[1] for e in extracted_entities if (e[0] or e[1])]
    rel_count = db.query(Relationship).filter(Relationship.case_id == case_id).count()

    return {
        "document_id": doc.id,
        "status": current_status,
        "percent": overall_percent,
        "is_complete": is_complete,
        "is_failed": is_failed,
        "error": doc.processing_error if is_failed else None,
        "stages": stages,
        "total_chunks": doc.total_chunks or 0,
        "total_pages": doc.total_pages or 0,
        "extracted_entities": entity_samples,
        "relationship_count": rel_count,
    }


@router.post("/{document_id}/process", status_code=202)
def trigger_manual_reprocessing(
    case_id: int,
    document_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Re-trigger background extraction & processing for a document."""
    doc = db.query(Document).filter(Document.id == document_id, Document.case_id == case_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.processing_status = "PENDING"
    doc.processing_error = None
    db.commit()

    background_tasks.add_task(process_document_background, document_id)
    return {"message": "Re-processing triggered successfully"}


@router.delete("/{document_id}", status_code=204)
def delete_document(
    case_id: int,
    document_id: int,
    req: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a document and its associated chunks, entities, etc."""
    doc = db.query(Document).filter(Document.id == document_id, Document.case_id == case_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file from disk
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    db.delete(doc)
    db.commit()

    log_action(db, current_user, "DELETE_DOCUMENT", "document", document_id,
               {"file_name": doc.original_name, "case_id": case_id}, req.client.host)


def process_document_background(document_id: int):
    """Background task: runs the full document processing pipeline."""
    from app.database.connection import SessionLocal
    from app.services.document_processor import DocumentProcessor

    db = SessionLocal()
    try:
        processor = DocumentProcessor(db)
        processor.process(document_id)
    except Exception as e:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.processing_status = "FAILED"
            doc.processing_error = str(e)
            db.commit()
    finally:
        db.close()

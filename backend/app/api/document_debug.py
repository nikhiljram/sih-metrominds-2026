"""Debug endpoint to manually trigger document processing synchronously"""

from fastapi import APIRouter, Depends, HTTPException
from app.models.user import User
from sqlalchemy.orm import Session

from app.models.document import Document
from app.dependencies import get_current_user, get_db
from app.services.document_processor import DocumentProcessor

router = APIRouter(prefix="/cases/{case_id}/documents", tags=["Documents Debug"])

@router.post("/{document_id}/process", status_code=202)
def trigger_document_processing(
    case_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trigger document processing synchronously for debugging purposes."""
    doc = db.query(Document).filter(Document.id == document_id, Document.case_id == case_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        processor = DocumentProcessor(db)
        processor.process(document_id)
        return {"detail": "Processing triggered synchronously"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

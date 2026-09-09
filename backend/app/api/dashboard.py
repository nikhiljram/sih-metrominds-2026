"""Dashboard API routes"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from app.database.connection import get_db
from app.models.user import User
from app.models.case import Case
from app.models.document import Document
from app.models.entity import Entity
from app.models.audit_log import AuditLog
from app.models.event import Event
from app.schemas.search import DashboardResponse, DashboardStats, RecentActivity
from app.schemas.case import CaseSummary
from app.dependencies import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse)
@router.get("/summary", response_model=DashboardResponse)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get dashboard data for the current user."""
    station_id = current_user.station_id

    # Stats
    active_cases = (
        db.query(sqlfunc.count(Case.id))
        .filter(Case.station_id == station_id, Case.status.in_(["ACTIVE", "UNDER_INVESTIGATION", "REGISTERED"]))
        .scalar() or 0
    )
    total_documents = (
        db.query(sqlfunc.count(Document.id))
        .join(Case, Document.case_id == Case.id)
        .filter(Case.station_id == station_id)
        .scalar() or 0
    )
    total_entities = (
        db.query(sqlfunc.count(Entity.id))
        .join(Case, Entity.case_id == Case.id)
        .filter(Case.station_id == station_id)
        .scalar() or 0
    )

    # Recent cases (last 10)
    recent_cases_raw = (
        db.query(Case)
        .filter(Case.station_id == station_id)
        .order_by(Case.updated_at.desc())
        .limit(10)
        .all()
    )

    case_ids = [c.id for c in recent_cases_raw]
    doc_counts = dict(
        db.query(Document.case_id, sqlfunc.count(Document.id))
        .filter(Document.case_id.in_(case_ids))
        .group_by(Document.case_id)
        .all()
    ) if case_ids else {}

    entity_counts = dict(
        db.query(Entity.case_id, sqlfunc.count(Entity.id))
        .filter(Entity.case_id.in_(case_ids))
        .group_by(Entity.case_id)
        .all()
    ) if case_ids else {}

    recent_cases = [
        CaseSummary(
            id=c.id,
            case_number=c.case_number,
            title=c.title,
            status=c.status,
            priority=c.priority,
            case_type=c.case_type,
            created_at=c.created_at,
            document_count=doc_counts.get(c.id, 0),
            entity_count=entity_counts.get(c.id, 0),
        ).model_dump()
        for c in recent_cases_raw
    ]

    # Recent activity (last 15)
    recent_logs = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(15)
        .all()
    )

    recent_activity = [
        RecentActivity(
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            details=str(log.details_json) if log.details_json else None,
            created_at=log.created_at,
        )
        for log in recent_logs
    ]

    return DashboardResponse(
        stats=DashboardStats(
            active_cases=active_cases,
            total_documents=total_documents,
            total_entities=total_entities,
            pending_alerts=0,
        ),
        recent_cases=recent_cases,
        recent_activity=recent_activity,
    )

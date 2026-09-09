"""Cases API routes"""

from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from datetime import datetime, timezone

from app.database.connection import get_db
from app.models.user import User
from app.models.case import Case
from app.models.case_member import CaseMember
from app.models.document import Document
from app.models.entity import Entity
from app.models.station import Station
from app.schemas.case import CaseCreate, CaseUpdate, CaseResponse, CaseListResponse
from app.dependencies import get_current_user, log_action

router = APIRouter(prefix="/cases", tags=["Cases"])


def generate_case_number() -> str:
    """Generate case number: CASE-YYYY-NNNNN"""
    year = datetime.now().year
    import secrets
    num = secrets.randbelow(90000) + 10000
    return f"CASE-{year}-{num:05d}"


@router.get("", response_model=CaseListResponse)
def list_cases(
    status_filter: str = Query(None, alias="status"),
    priority: str = Query(None),
    case_type: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List cases with filters and pagination."""
    query = db.query(Case).filter(Case.station_id == current_user.station_id)

    if status_filter:
        query = query.filter(Case.status == status_filter)
    if priority:
        query = query.filter(Case.priority == priority)
    if case_type:
        query = query.filter(Case.case_type == case_type)

    total = query.count()
    cases_raw = query.order_by(Case.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    cases = []
    for c in cases_raw:
        doc_count = db.query(sqlfunc.count(Document.id)).filter(Document.case_id == c.id).scalar()
        entity_count = db.query(sqlfunc.count(Entity.id)).filter(Entity.case_id == c.id).scalar()
        creator = db.query(User).filter(User.id == c.created_by).first()
        station = db.query(Station).filter(Station.id == c.station_id).first()

        cases.append(CaseResponse(
            id=c.id,
            case_number=c.case_number,
            fir_number=c.fir_number,
            title=c.title,
            description=c.description,
            case_type=c.case_type,
            status=c.status,
            priority=c.priority,
            station_id=c.station_id,
            created_by=c.created_by,
            ai_summary=c.ai_summary,
            ai_open_questions=c.ai_open_questions,
            incident_date=c.incident_date,
            incident_location=c.incident_location,
            created_at=c.created_at,
            updated_at=c.updated_at,
            document_count=doc_count or 0,
            entity_count=entity_count or 0,
            creator_name=creator.name if creator else None,
            station_name=station.station_name if station else None,
        ))

    return CaseListResponse(cases=cases, total=total, page=page, page_size=page_size)


@router.post("", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
def create_case(
    case_data: CaseCreate,
    req: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new case."""
    case_number = generate_case_number()

    # Ensure unique
    while db.query(Case).filter(Case.case_number == case_number).first():
        case_number = generate_case_number()

    new_case = Case(
        case_number=case_number,
        fir_number=case_data.fir_number,
        title=case_data.title,
        description=case_data.description,
        case_type=case_data.case_type,
        priority=case_data.priority,
        status="ACTIVE",
        station_id=current_user.station_id,
        created_by=current_user.id,
        incident_date=case_data.incident_date,
        incident_location=case_data.incident_location,
    )
    db.add(new_case)
    db.flush()

    # Add creator as lead investigator
    member = CaseMember(
        case_id=new_case.id,
        user_id=current_user.id,
        role="LEAD_INVESTIGATOR",
    )
    db.add(member)

    # Add other investigators if specified
    if case_data.assigned_investigators:
        for uid in case_data.assigned_investigators:
            if uid != current_user.id:
                db.add(CaseMember(case_id=new_case.id, user_id=uid, role="INVESTIGATOR"))

    db.commit()
    db.refresh(new_case)

    log_action(db, current_user, "CREATE_CASE", "case", new_case.id,
               {"case_number": case_number}, req.client.host)

    return CaseResponse(
        id=new_case.id,
        case_number=new_case.case_number,
        fir_number=new_case.fir_number,
        title=new_case.title,
        description=new_case.description,
        case_type=new_case.case_type,
        status=new_case.status,
        priority=new_case.priority,
        station_id=new_case.station_id,
        created_by=new_case.created_by,
        incident_date=new_case.incident_date,
        incident_location=new_case.incident_location,
        created_at=new_case.created_at,
        updated_at=new_case.updated_at,
        creator_name=current_user.name,
    )


@router.get("/{case_id}", response_model=CaseResponse)
def get_case(
    case_id: int,
    req: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single case with computed fields."""
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    if current_user.role not in ["SUPER_ADMIN", "ADMIN"] and c.station_id != current_user.station_id:
        raise HTTPException(status_code=403, detail="Not authorized to access cases outside your station")

    doc_count = db.query(sqlfunc.count(Document.id)).filter(Document.case_id == c.id).scalar()
    entity_count = db.query(sqlfunc.count(Entity.id)).filter(Entity.case_id == c.id).scalar()
    creator = db.query(User).filter(User.id == c.created_by).first()
    station = db.query(Station).filter(Station.id == c.station_id).first()

    log_action(db, current_user, "VIEW_CASE", "case", case_id, ip_address=req.client.host)

    return CaseResponse(
        id=c.id,
        case_number=c.case_number,
        fir_number=c.fir_number,
        title=c.title,
        description=c.description,
        case_type=c.case_type,
        status=c.status,
        priority=c.priority,
        station_id=c.station_id,
        created_by=c.created_by,
        ai_summary=c.ai_summary,
        ai_open_questions=c.ai_open_questions,
        incident_date=c.incident_date,
        incident_location=c.incident_location,
        created_at=c.created_at,
        updated_at=c.updated_at,
        document_count=doc_count or 0,
        entity_count=entity_count or 0,
        creator_name=creator.name if creator else None,
        station_name=station.station_name if station else None,
    )


@router.put("/{case_id}", response_model=CaseResponse)
def update_case(
    case_id: int,
    case_data: CaseUpdate,
    req: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update case details."""
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    if current_user.role not in ["SUPER_ADMIN", "ADMIN"] and c.station_id != current_user.station_id:
        raise HTTPException(status_code=403, detail="Not authorized to update cases outside your station")

    update_fields = case_data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(c, field, value)

    db.commit()
    db.refresh(c)

    log_action(db, current_user, "UPDATE_CASE", "case", case_id,
               {"updated_fields": list(update_fields.keys())}, req.client.host)

    return get_case(case_id, req, current_user, db)

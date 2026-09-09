'''seed_cases.py
Create two dummy cases for development/testing.
'''import os
from app.database.connection import SessionLocal
from app.models.case import Case
from app.models.case_member import CaseMember
from app.models.user import User
from sqlalchemy.orm import Session
from datetime import datetime

def get_station_user(session: Session):
    # Return first active user and its station for association
    user = session.query(User).filter(User.is_active == True).first()
    return user

def create_dummy_case(session: Session, user, title, description, case_type='OTHER', priority='MEDIUM'):
    # Generate a simple case number
    case_number = f"CASE-{datetime.now().year}-{int(datetime.timestamp(datetime.now())) % 100000:05d}"
    new_case = Case(
        case_number=case_number,
        fir_number='FIR12345',
        title=title,
        description=description,
        case_type=case_type,
        priority=priority,
        status='ACTIVE',
        station_id=user.station_id,
        created_by=user.id,
        incident_date=datetime.now().date(),
        incident_location='Test Location',
    )
    session.add(new_case)
    session.flush()
    # Add lead investigator link
    session.add(CaseMember(case_id=new_case.id, user_id=user.id, role='LEAD_INVESTIGATOR'))
    return new_case

def main():
    session = SessionLocal()
    user = get_station_user(session)
    if not user:
        print('No active user found. Create a user first.')
        return
    case1 = create_dummy_case(session, user, 'Dummy Case 1', 'Description for dummy case 1')
    case2 = create_dummy_case(session, user, 'Dummy Case 2', 'Description for dummy case 2')
    session.commit()
    print(f'Created cases: {case1.id}, {case2.id}')

if __name__ == '__main__':
    main()

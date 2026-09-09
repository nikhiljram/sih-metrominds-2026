"""
Seed database with realistic initial investigation data
"""

import sys
import os

# Add parent dir to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.connection import SessionLocal, init_db
from app.models.user import User
from app.models.case import Case
from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.models.entity import Entity
from app.models.entity_source import EntitySource
from app.models.relationship import Relationship
from app.models.chat_session import ChatSession
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

from app.models.station import Station

def seed_database():
    init_db()
    db = SessionLocal()
    
    try:
        # 1. Station
        station = db.query(Station).filter_by(station_code="BLR-CYBER-01").first()
        if not station:
            station = Station(
                station_code="BLR-CYBER-01",
                station_name="Bengaluru Cyber Crime Police Station",
                district="Bengaluru Urban",
                city="Bengaluru",
                state="Karnataka",
                phone="080-22942222",
                is_active=True
            )
            db.add(station)
            db.commit()
            db.refresh(station)
            print("Created Station: BLR-CYBER-01")

        # 2. Admin User / Officer
        user = db.query(User).filter_by(employee_id="OFF-2026-001").first()
        if not user:
            user = User(
                employee_id="OFF-2026-001",
                name="Inspector Rajesh Kumar",
                email="rajesh.kumar@ksp.gov.in",
                password_hash=pwd_context.hash("admin123"),
                role="ADMIN",
                designation="Senior Cyber Investigator",
                station_id=station.id,
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print("Created Officer user OFF-2026-001")

        user_inv = db.query(User).filter_by(employee_id="INV-2026-001").first()
        if not user_inv:
            user_inv = User(
                employee_id="INV-2026-001",
                name="Agent D. Vance",
                email="agent.vance@ksp.gov.in",
                password_hash=pwd_context.hash("admin123"),
                role="ADMIN",
                designation="Senior Investigator",
                station_id=station.id,
                is_active=True
            )
            db.add(user_inv)
            db.commit()
            print("Created Officer user INV-2026-001")

        # 3. Sample Case
        case = db.query(Case).filter_by(case_number="FIR-2026-0891").first()
        if not case:
            case = Case(
                case_number="FIR-2026-0891",
                fir_number="FIR/BLR/2026/0891",
                title="Operation Phantom Wire - Multi-State Financial Fraud",
                description="Cross-jurisdictional shell company network laundering money via cryptocurrency exchanges and fake invoice payments across 4 state borders.",
                case_type="CYBERCRIME",
                incident_location="Bengaluru Urban / Gurugram",
                status="UNDER_INVESTIGATION",
                priority="HIGH",
                station_id=station.id,
                created_by=user.id
            )
            db.add(case)
            db.commit()
            db.refresh(case)
            print(f"Created Case: {case.title}")

            # Entities
            e1 = Entity(case_id=case.id, entity_value="Vikram Roy", display_name="Vikram Roy", entity_type="PERSON", confidence=0.95, metadata_json={"role": "Primary Suspect"})
            e2 = Entity(case_id=case.id, entity_value="Apex Horizon FinTech Ltd", display_name="Apex Horizon FinTech Ltd", entity_type="ORGANIZATION", confidence=0.98, metadata_json={"registration": "DL-2022-99128"})
            e3 = Entity(case_id=case.id, entity_value="Bank of Mumbai #9928110", display_name="Bank of Mumbai #9928110", entity_type="BANK_ACCOUNT", confidence=0.92, metadata_json={"ifsc": "BOM0001928"})
            e4 = Entity(case_id=case.id, entity_value="Wallet 0x71C...9B12", display_name="Wallet 0x71C...9B12", entity_type="BANK_ACCOUNT", confidence=0.88, metadata_json={"chain": "Ethereum"})
            e5 = Entity(case_id=case.id, entity_value="Cyber Park Tower B, Gurugram", display_name="Cyber Park Tower B, Gurugram", entity_type="LOCATION", confidence=0.90)

            db.add_all([e1, e2, e3, e4, e5])
            db.commit()

            # Relationships
            r1 = Relationship(case_id=case.id, source_entity_id=e1.id, target_entity_id=e2.id, relationship_type="EMPLOYED_BY", relationship_label="Managing Director", confidence=0.95)
            r2 = Relationship(case_id=case.id, source_entity_id=e2.id, target_entity_id=e3.id, relationship_type="OWNS", relationship_label="Corporate Account", confidence=0.99)
            r3 = Relationship(case_id=case.id, source_entity_id=e3.id, target_entity_id=e4.id, relationship_type="TRANSFERRED_TO", relationship_label="₹4.5Cr Transfer", confidence=0.89)
            r4 = Relationship(case_id=case.id, source_entity_id=e2.id, target_entity_id=e5.id, relationship_type="LOCATED_AT", relationship_label="Registered Office", confidence=0.91)

            db.add_all([r1, r2, r3, r4])
            db.commit()
            print("Seeded entities and relationships successfully.")

    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

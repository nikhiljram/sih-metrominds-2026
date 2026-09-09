"""Database connection and session management"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings


database_url = settings.DATABASE_URL
if database_url.startswith("mysql"):
    try:
        # Test connection or fallback gracefully to SQLite for local development
        from sqlalchemy import create_engine as test_engine
        t = test_engine(database_url, connect_args={"connect_timeout": 2})
        conn = t.connect()
        conn.close()
    except Exception:
        print("[WARN] MySQL server unavailable. Falling back to local SQLite database 'investigation.db'")
        database_url = "sqlite:///./investigation.db"

if database_url.startswith("sqlite"):
    engine = create_engine(database_url, connect_args={"check_same_thread": False})
else:
    engine = create_engine(
        database_url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=settings.DEBUG,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dependency: yields a DB session, auto-closes after request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables from ORM models and ensure schema column widths."""
    from app.models import (  # noqa: F401
        station, user, case, case_member, document,
        chunk, entity, entity_source, relationship,
        event, chat_session, chat_message, audit_log,
    )
    Base.metadata.create_all(bind=engine)

    # Ensure document_type is wide enough in MySQL
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            if engine.name == "mysql":
                conn.execute(text("ALTER TABLE documents MODIFY COLUMN document_type VARCHAR(100) DEFAULT 'OTHER'"))
                conn.commit()
    except Exception as e:
        print(f"ℹ️ Schema adjustment note: {e}")

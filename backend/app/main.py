import sys
import os

# Ensure backend root and app package are in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database.connection import init_db

# Import routers
from app.api.auth import router as auth_router
from app.api.cases import router as cases_router
from app.api.documents import router as documents_router
from app.api.search import router as search_router
from app.api.graph import router as graph_router
from app.api.chat import router as chat_router
from app.api.dashboard import router as dashboard_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    try:
        init_db()
    except Exception as e:
        print(f"[WARN] Database init notice: {e}")

    try:
        from scripts.seed import seed_database
        seed_database()
        print("✅ Database seeded successfully")
    except Exception as e:
        print(f"ℹ️ Seed skipped or completed: {e}")
    # Create upload directory
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    print("✅ Database initialized")
    print(f"✅ Upload directory: {settings.UPLOAD_DIR}")
    yield
    print("🛑 Shutting down")


app = FastAPI(
    title="Investigation Intelligence Platform",
    description="Evidence-Grounded Investigation Assistant API",
    version="1.0.0",
    lifespan=lifespan,
)

allowed_origins = [
    "https://sih-metrominds-2026.vercel.app",
    "https://investigation-proj-sih26.vercel.app",
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:3000"
]

# Clean up duplicates & empty strings
allowed_origins = list(set([o for o in allowed_origins if o]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.core_logger import log_event, logger

@app.middleware("http")
async def request_logging_middleware(request, call_next):
    start_time = os.times().elapsed
    try:
        response = await call_next(request)
        process_time = round((os.times().elapsed - start_time) * 1000, 2)
        log_event("HTTP_REQUEST", {
            "method": request.method,
            "url": str(request.url),
            "status_code": response.status_code,
            "latency_ms": process_time
        })
        return response
    except Exception as exc:
        logger.error(f"Unhandled Exception on {request.method} {request.url}: {exc}")
        log_event("HTTP_ERROR", {
            "method": request.method,
            "url": str(request.url),
            "error": str(exc)
        }, level="ERROR")
        raise exc

# Mount API routes
app.include_router(auth_router, prefix="/api/v1")
app.include_router(cases_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(search_router, prefix="/api/v1")
app.include_router(graph_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "name": "Investigation Intelligence Platform",
        "version": "1.0.0",
        "status": "operational",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/api/v1/system-logs")
def get_live_system_logs(limit: int = 100):
    """Retrieve the latest live system logs directly from the Railway cloud server."""
    log_path = os.path.join(os.path.dirname(BASE_DIR), "logs", "system.log")
    if not os.path.exists(log_path):
        return {"logs": ["No log file found on server yet."]}
    try:
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            return {
                "total_lines": len(lines),
                "latest_logs": [line.strip() for line in lines[-limit:]]
            }
    except Exception as e:
        return {"error": str(e)}

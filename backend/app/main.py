"""Investigation Intelligence Platform — FastAPI Application"""

import os
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
    # Create tables
    init_db()
    # Auto-seed database if empty
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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

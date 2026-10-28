from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import SERVICE_HOST, SERVICE_PORT, ALLOWED_ORIGINS, ENVIRONMENT

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("careerbridge-ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"CareerBridge AI Service started on http://{SERVICE_HOST}:{SERVICE_PORT}")
    logger.info("CareerBridge AI Service started on http://%s:%s", SERVICE_HOST, SERVICE_PORT)
    # Warm up sentence transformer model so first request is fast
    from app.services.embedding_model import get_model
    get_model()
    logger.info("Embedding model loaded and ready")
    print("Embedding model loaded and ready")
    yield


app = FastAPI(
    title="CareerBridge AI Service",
    version="1.0.0",
    description="Standalone AI microservice for resume parsing, semantic matching, and placement prediction. Does NOT access the database directly.",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def global_exception_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        logger.exception("Unhandled exception in AI service: %s", exc)
        detail_msg = str(exc) if ENVIRONMENT == "development" else "An unexpected error occurred."
        return JSONResponse(
            status_code=500,
            content={"error": "Internal AI service error", "detail": detail_msg},
        )


@app.get("/", tags=["General"])
def root():
    return {
        "message": "Welcome to CareerBridge AI Service",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["General"])
def health():
    return {
        "status": "healthy",
        "service": "careerbridge-ai",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


from app.routers import resume, matching, analytics, readiness, skill_gap, ats, roadmap

# Mount routers
app.include_router(resume.router)
app.include_router(matching.router)
app.include_router(analytics.router)
app.include_router(readiness.router)
app.include_router(skill_gap.router)
app.include_router(ats.router)
app.include_router(roadmap.router)



"""CareerCompass FastAPI application entry point."""

from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.requests import Request

from app import models  # noqa: F401 - importing registers every model with Base.metadata
from app.database import Base, engine
from app.routers import alumni, announcements, applications, auth, companies, mentorship, roadmap, resumes, skills, students, tp_cell

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("careercompass")

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Create missing tables without dropping or resetting existing data."""
    if engine is None:
        logger.warning("DATABASE_URL is not configured; API docs will load but database routes return 503.")
    else:
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("CareerCompass MySQL schema is ready.")
        except SQLAlchemyError:
            logger.exception("MySQL schema initialization failed; API remains available for diagnostics.")
    yield


app = FastAPI(
    title="CareerCompass API",
    description="College placement, student readiness, alumni mentorship, and T&P management API.",
    version="1.0.0",
    openapi_tags=[
        {"name": "Authentication", "description": "Registration, login, and the current account."},
        {"name": "Students", "description": "Private student profile, skills, and resumes."},
        {"name": "Alumni", "description": "Alumni profiles and directory."},
        {"name": "Skills", "description": "Shared skill catalog."},
        {"name": "Resumes", "description": "Private resume access for an applied company."},
        {"name": "Companies", "description": "Placement company and eligibility management."},
        {"name": "Applications", "description": "Student placement applications and T&P decisions."},
        {"name": "Roadmap", "description": "Private student preparation roadmap."},
        {"name": "Mentorship", "description": "Student-to-alumni mentorship requests."},
        {"name": "Announcements", "description": "T&P announcements."},
        {"name": "T&P Cell", "description": "Student readiness and placement analytics."},
    ],
    lifespan=lifespan,
)


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(_request: Request, error: SQLAlchemyError) -> JSONResponse:
    logger.exception("Database request failed.", exc_info=error)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "MySQL is unavailable. Verify the local MySQL Server and DATABASE_URL."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router_module in (auth, students, alumni, skills, resumes, companies, applications, roadmap, mentorship, announcements, tp_cell):
    app.include_router(router_module.router)

app.include_router(tp_cell.tp_cell_router)



@app.get("/", tags=["Health"])
def root() -> dict[str, str]:
    return {"message": "CareerCompass Backend is running"}


@app.get("/api/health", tags=["Health"])
def health() -> dict[str, str]:
    if engine is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MySQL is not configured. Set DATABASE_URL in backend/.env.",
        )
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        logger.exception("MySQL health check failed.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MySQL is unavailable. Verify the local MySQL Server and DATABASE_URL.",
        ) from error
    return {"status": "ok", "service": "CareerCompass API"}
"""SQLAlchemy engine, session, and declarative base configuration."""

from collections.abc import Generator
from pathlib import Path
import os
from urllib.parse import unquote

from dotenv import load_dotenv
from fastapi import HTTPException, status
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


class Base(DeclarativeBase):
    """Base class shared by all SQLAlchemy models."""


def build_database_url(raw_url: str | None) -> URL | None:
    """Parse a MySQL URL using its final @, allowing @ inside a raw password."""
    if not raw_url or "YOUR_MYSQL_PASSWORD" in raw_url:
        return None
    try:
        driver, remainder = raw_url.split("://", 1)
        credentials, endpoint = remainder.rsplit("@", 1)
        username, password = credentials.split(":", 1)
        host_port, database = endpoint.split("/", 1)
        if ":" in host_port:
            host, port_text = host_port.rsplit(":", 1)
            port = int(port_text)
        else:
            host, port = host_port, 3306
        return URL.create(
            drivername=driver,
            username=unquote(username),
            password=unquote(password),
            host=host,
            port=port,
            database=database,
        )
    except (ValueError, TypeError):
        return None


database_url = build_database_url(os.getenv("DATABASE_URL"))
engine = create_engine(database_url, pool_pre_ping=True) if database_url else None
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False) if engine else None


def get_db() -> Generator[Session, None, None]:
    """Yield a database session for one request."""
    if SessionLocal is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not configured. Add DATABASE_URL to backend/.env.",
        )

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
"""Placement company and eligibility criteria models."""

from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Company(Base):
    __tablename__ = "companies"
    __table_args__ = (CheckConstraint("status IN ('upcoming', 'open', 'closed', 'completed')", name="ck_companies_status"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(String(500))
    location: Mapped[str | None] = mapped_column(String(180))
    industry: Mapped[str | None] = mapped_column(String(120))
    job_role: Mapped[str] = mapped_column(String(180), nullable=False)
    package: Mapped[float | None] = mapped_column(Float)
    minimum_cgpa: Mapped[float | None] = mapped_column(Float)
    graduation_year: Mapped[int | None] = mapped_column()
    status: Mapped[str] = mapped_column(String(20), default="upcoming", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    criteria: Mapped["CompanyCriteria | None"] = relationship(back_populates="company", cascade="all, delete-orphan", uselist=False)
    applications: Mapped[list["Application"]] = relationship(back_populates="company", cascade="all, delete-orphan")


class CompanyCriteria(Base):
    __tablename__ = "company_criteria"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), unique=True, nullable=False)
    criteria_text: Mapped[str | None] = mapped_column(Text)
    minimum_cgpa: Mapped[float | None] = mapped_column(Float)
    required_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    eligible_branches: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    eligible_years: Mapped[list[int]] = mapped_column(JSON, default=list, nullable=False)

    company: Mapped[Company] = relationship(back_populates="criteria")
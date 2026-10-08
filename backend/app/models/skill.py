"""Reusable skill catalog and student proficiency association."""

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)

    student_links: Mapped[list["StudentSkill"]] = relationship(back_populates="skill", cascade="all, delete-orphan")


class StudentSkill(Base):
    __tablename__ = "student_skills"

    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
    proficiency: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)

    student: Mapped["StudentProfile"] = relationship(back_populates="skills")
    skill: Mapped[Skill] = relationship(back_populates="student_links")
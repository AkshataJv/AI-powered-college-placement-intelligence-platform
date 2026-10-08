"""SQLAlchemy model for Student Certificates."""

from datetime import datetime
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.database import Base


class Certificate(Base):
    """Certificate credentials and uploaded documents belonging to students."""

    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    issuer = Column(String(255), nullable=False)
    issue_date = Column(Date, nullable=False)
    credential_id = Column(String(255), nullable=True)
    credential_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    file_name = Column(String(255), nullable=True)
    file_path = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=False, default=0)
    uploaded_at = Column(DateTime, nullable=False, server_default=func.now())

    student = relationship("StudentProfile", back_populates="certificates")

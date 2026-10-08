"""Import every model so SQLAlchemy registers all metadata relationships."""

from app.models.alumni import AlumniProfile
from app.models.announcement import Announcement
from app.models.application import Application
from app.models.certificate import Certificate
from app.models.company import Company, CompanyCriteria
from app.models.mentorship import MentorshipRequest
from app.models.resume import Resume
from app.models.roadmap import Roadmap
from app.models.skill import Skill, StudentSkill
from app.models.student import StudentProfile
from app.models.user import User

__all__ = [
    "AlumniProfile",
    "Announcement",
    "Application",
    "Certificate",
    "Company",
    "CompanyCriteria",
    "MentorshipRequest",
    "Resume",
    "Roadmap",
    "Skill",
    "StudentProfile",
    "StudentSkill",
    "User",
]
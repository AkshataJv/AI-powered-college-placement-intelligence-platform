"""Shared skill catalog endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_tp_cell
from app.models.skill import Skill
from app.models.user import User
from app.schemas.skill import SkillCreate, SkillResponse

router = APIRouter(prefix="/api/skills", tags=["Skills"])


@router.get("", response_model=list[SkillResponse])
def list_skills(db: Session = Depends(get_db)) -> list[SkillResponse]:
    return [SkillResponse.model_validate(skill) for skill in db.query(Skill).order_by(Skill.category, Skill.name).all()]


@router.post("", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
def create_skill(payload: SkillCreate, _user: User = Depends(require_tp_cell), db: Session = Depends(get_db)) -> SkillResponse:
    skill = Skill(name=payload.name.strip(), category=payload.category.strip())
    db.add(skill)
    try:
        db.commit()
        db.refresh(skill)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A skill with this name already exists.") from error
    return SkillResponse.model_validate(skill)
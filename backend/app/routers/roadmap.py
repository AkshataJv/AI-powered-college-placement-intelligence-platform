"""Student-owned roadmap CRUD."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_student
from app.models.roadmap import Roadmap
from app.models.student import StudentProfile
from app.models.user import User
from app.schemas.roadmap import RoadmapCreate, RoadmapResponse, RoadmapUpdate

router = APIRouter(prefix="/api/students/me/roadmap", tags=["Roadmap"])


def get_student_id(db: Session, user_id: int) -> int:
    profile = db.query(StudentProfile.id).filter(StudentProfile.user_id == user_id).scalar()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile was not found.")
    return profile


@router.get("", response_model=list[RoadmapResponse])
def list_roadmap(user: User = Depends(require_student), db: Session = Depends(get_db)) -> list[RoadmapResponse]:
    items = db.query(Roadmap).filter(Roadmap.student_id == get_student_id(db, user.id)).order_by(Roadmap.target_date.asc()).all()
    return [RoadmapResponse.model_validate(item) for item in items]


@router.post("", response_model=RoadmapResponse, status_code=status.HTTP_201_CREATED)
def create_roadmap_item(payload: RoadmapCreate, user: User = Depends(require_student), db: Session = Depends(get_db)) -> RoadmapResponse:
    item = Roadmap(student_id=get_student_id(db, user.id), **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return RoadmapResponse.model_validate(item)


@router.put("/{roadmap_id}", response_model=RoadmapResponse)
def update_roadmap_item(roadmap_id: int, payload: RoadmapUpdate, user: User = Depends(require_student), db: Session = Depends(get_db)) -> RoadmapResponse:
    item = db.query(Roadmap).filter(Roadmap.id == roadmap_id, Roadmap.student_id == get_student_id(db, user.id)).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Roadmap item was not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return RoadmapResponse.model_validate(item)


@router.delete("/{roadmap_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_roadmap_item(roadmap_id: int, user: User = Depends(require_student), db: Session = Depends(get_db)) -> None:
    item = db.query(Roadmap).filter(Roadmap.id == roadmap_id, Roadmap.student_id == get_student_id(db, user.id)).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Roadmap item was not found.")
    db.delete(item)
    db.commit()
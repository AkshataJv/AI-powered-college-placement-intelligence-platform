"""T&P-managed announcements visible to all three platform roles."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_tp_cell
from app.models.announcement import Announcement
from app.models.user import User
from app.schemas.announcement import AnnouncementCreate, AnnouncementResponse, AnnouncementUpdate

router = APIRouter(prefix="/api/announcements", tags=["Announcements"])


@router.get("", response_model=list[AnnouncementResponse])
def list_announcements(_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[AnnouncementResponse]:
    rows = db.query(Announcement).filter(Announcement.is_active.is_(True)).order_by(Announcement.created_at.desc()).all()
    return [AnnouncementResponse.model_validate(row) for row in rows]


@router.post("", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
def create_announcement(payload: AnnouncementCreate, user: User = Depends(require_tp_cell), db: Session = Depends(get_db)) -> AnnouncementResponse:
    announcement = Announcement(created_by=user.id, **payload.model_dump())
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return AnnouncementResponse.model_validate(announcement)


@router.put("/{announcement_id}", response_model=AnnouncementResponse)
def update_announcement(
    announcement_id: int,
    payload: AnnouncementUpdate,
    _user: User = Depends(require_tp_cell),
    db: Session = Depends(get_db),
) -> AnnouncementResponse:
    announcement = db.get(Announcement, announcement_id)
    if announcement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement was not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(announcement, field, value)
    db.commit()
    db.refresh(announcement)
    return AnnouncementResponse.model_validate(announcement)


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(announcement_id: int, _user: User = Depends(require_tp_cell), db: Session = Depends(get_db)) -> None:
    announcement = db.get(Announcement, announcement_id)
    if announcement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement was not found.")
    db.delete(announcement)
    db.commit()
"""Alumni profile and public directory endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_alumni
from app.models.alumni import AlumniProfile
from app.models.user import User
from app.schemas.alumni import AlumniProfileResponse, AlumniResponse, AlumniProfileUpdate
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/api/alumni", tags=["Alumni"])


def get_profile(db: Session, user_id: int) -> AlumniProfile:
    profile = db.query(AlumniProfile).filter(AlumniProfile.user_id == user_id).first()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alumni profile was not found.")
    return profile


@router.get("/me", response_model=AlumniResponse)
def read_alumni_profile(user: User = Depends(require_alumni), db: Session = Depends(get_db)) -> AlumniResponse:
    return AlumniResponse(user=UserResponse.model_validate(user), profile=AlumniProfileResponse.model_validate(get_profile(db, user.id)))


@router.put("/me", response_model=AlumniResponse)
def update_alumni_profile(
    payload: AlumniProfileUpdate,
    user: User = Depends(require_alumni),
    db: Session = Depends(get_db),
) -> AlumniResponse:
    profile = get_profile(db, user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return AlumniResponse(user=UserResponse.model_validate(user), profile=AlumniProfileResponse.model_validate(profile))


@router.get("", response_model=list[AlumniResponse])
def list_alumni(_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[AlumniResponse]:
    profiles = db.query(AlumniProfile).options(joinedload(AlumniProfile.user)).order_by(AlumniProfile.id.desc()).all()
    return [AlumniResponse(user=UserResponse.model_validate(profile.user), profile=AlumniProfileResponse.model_validate(profile)) for profile in profiles]


@router.get("/{alumni_id}", response_model=AlumniResponse)
def get_alumni(alumni_id: int, _user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AlumniResponse:
    profile = db.query(AlumniProfile).options(joinedload(AlumniProfile.user)).filter(AlumniProfile.user_id == alumni_id).first()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alumni profile was not found.")
    return AlumniResponse(user=UserResponse.model_validate(profile.user), profile=AlumniProfileResponse.model_validate(profile))
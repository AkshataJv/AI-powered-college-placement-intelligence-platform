"""Account registration and JWT login routes."""

from fastapi import APIRouter, Depends, HTTPException, status
import hmac
import os
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.jwt import create_access_token
from app.auth.security import hash_password, verify_password
from app.database import get_db
from app.dependencies import get_current_user
from app.models.alumni import AlumniProfile
from app.models.student import StudentProfile
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Create an account and its role profile; duplicate emails return 409."""
    if payload.role.value == "tp_cell":
        invite_code = os.getenv("TP_CELL_INVITE_CODE")
        if (
            not invite_code
            or invite_code == "SET_A_PRIVATE_TP_CELL_INVITE_CODE"
            or not payload.tp_cell_invite_code
            or not hmac.compare_digest(payload.tp_cell_invite_code, invite_code)
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="A valid T&P Cell invitation code is required.")

    user = User(
        name=payload.name.strip(),
        email=str(payload.email).lower(),
        password_hash=hash_password(payload.password),
        role=payload.role.value,
    )
    if payload.role.value == "student":
        user.student_profile = StudentProfile()
    elif payload.role.value == "alumni":
        user.alumni_profile = AlumniProfile()

    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.") from error

    try:
        token = create_access_token(user.id, user.email, user.role)
    except RuntimeError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    return TokenResponse(access_token=token, role=user.role, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == str(payload.email).lower()).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect.")

    try:
        token = create_access_token(user.id, user.email, user.role)
    except RuntimeError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    return TokenResponse(access_token=token, role=user.role, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def read_current_user(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(user)
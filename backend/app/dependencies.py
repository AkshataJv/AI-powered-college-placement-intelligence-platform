"""Reusable database, authentication, and role dependencies."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.auth.jwt import decode_access_token
from app.database import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve a bearer token to its current database user."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication is required.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload.get("sub", ""))
    except (JWTError, ValueError, TypeError) as error:
        raise unauthorized from error

    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    return user


def require_roles(*roles: str):
    """Build a dependency that permits only the requested roles."""
    def role_dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to access this resource.")
        return user

    return role_dependency


def require_student(user: User = Depends(require_roles("student"))) -> User:
    return user


def require_alumni(user: User = Depends(require_roles("alumni"))) -> User:
    return user


def require_tp_cell(user: User = Depends(require_roles("tp_cell"))) -> User:
    return user



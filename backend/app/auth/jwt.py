"""JWT creation and decoding."""

from datetime import datetime, timedelta, timezone
import os
from typing import Any

from jose import JWTError, jwt

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))


def create_access_token(user_id: int, email: str, role: str) -> str:
    """Create a signed token containing identity, role, and expiration."""
    secret_key = os.getenv("SECRET_KEY")
    if not secret_key or secret_key == "CHANGE_THIS_SECRET_KEY" or len(secret_key) < 32:
        raise RuntimeError("Set SECRET_KEY in backend/.env to a random value at least 32 characters long.")

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": expires_at,
    }
    return jwt.encode(payload, secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode a token or raise JWTError when invalid or expired."""
    secret_key = os.getenv("SECRET_KEY")
    if not secret_key or secret_key == "CHANGE_THIS_SECRET_KEY" or len(secret_key) < 32:
        raise JWTError("JWT secret is not configured.")
    return jwt.decode(token, secret_key, algorithms=[ALGORITHM])
"""Password hashing using Argon2 through pwdlib."""

from pwdlib import PasswordHash

password_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Return an Argon2 hash suitable for storage in MySQL."""
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Compare a plain password with its stored secure hash."""
    try:
        return password_hasher.verify(password, password_hash)
    except (ValueError, TypeError):
        return False
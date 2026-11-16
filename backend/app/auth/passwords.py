import bcrypt

from app.config import get_settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(get_settings().bcrypt_rounds)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:  # e.g. password longer than bcrypt's 72-byte limit
        return False


# Used to spend equal time on unknown usernames so login timing does not reveal them.
DUMMY_HASH = hash_password("dummy-password-for-timing")

import secrets
import bcrypt

_sessions: dict[str, str] = {}


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=10)
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except Exception:
        return False


def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    _sessions[token] = user_id
    return token


def get_user_id(token: str) -> str | None:
    return _sessions.get(token)


def delete_session(token: str) -> None:
    _sessions.pop(token, None)
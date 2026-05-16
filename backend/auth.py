import secrets

_sessions: dict[str, str] = {}

VALID_USERNAME = "user"
VALID_PASSWORD = "password"


def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    _sessions[token] = user_id
    return token


def get_user_id(token: str) -> str | None:
    return _sessions.get(token)


def delete_session(token: str) -> None:
    _sessions.pop(token, None)

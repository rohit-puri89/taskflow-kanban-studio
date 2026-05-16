import os
import sys
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

# Add backend/ to path so tests can import main, db, auth directly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

TEST_USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
TEST_COL_ID  = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
TEST_CARD_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"

# Patch DB lifecycle for all tests so no real Postgres connection is attempted
def pytest_configure(config):
    patch("db.init_pool", new=AsyncMock()).start()
    patch("db.init_db",   new=AsyncMock()).start()
    patch("db.close_pool", new=AsyncMock()).start()


@pytest.fixture(autouse=True)
def clear_sessions():
    import auth as auth_module
    auth_module._sessions.clear()
    yield
    auth_module._sessions.clear()


@pytest.fixture
def client():
    import db
    from main import app

    app.dependency_overrides[db.get_pool] = lambda: None
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    with patch("db.get_user", new=AsyncMock(return_value={"id": TEST_USER_ID})):
        resp = client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )
    assert resp.status_code == 200
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}

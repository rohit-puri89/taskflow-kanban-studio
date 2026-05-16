from unittest.mock import AsyncMock, patch

from tests.conftest import TEST_USER_ID


def test_login_correct_credentials(client):
    with patch("db.get_user", new=AsyncMock(return_value={"id": TEST_USER_ID})):
        resp = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert resp.status_code == 200
    assert "token" in resp.json()


def test_login_wrong_password(client):
    resp = client.post("/api/auth/login", json={"username": "user", "password": "wrong"})
    assert resp.status_code == 401


def test_login_wrong_username(client):
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "password"})
    assert resp.status_code == 401


def test_logout(client, auth_headers):
    resp = client.post("/api/auth/logout", headers=auth_headers)
    assert resp.status_code == 200
    # Token should now be invalid
    resp2 = client.get("/api/board", headers=auth_headers)
    assert resp2.status_code == 401


def test_logout_no_token(client):
    resp = client.post("/api/auth/logout")
    assert resp.status_code == 401

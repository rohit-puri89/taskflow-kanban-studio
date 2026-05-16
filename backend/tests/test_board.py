from unittest.mock import AsyncMock, patch

from tests.conftest import TEST_CARD_ID, TEST_COL_ID, TEST_USER_ID

BOARD_DATA = {
    "columns": [{"id": TEST_COL_ID, "title": "Backlog", "cardIds": [TEST_CARD_ID]}],
    "cards": {TEST_CARD_ID: {"id": TEST_CARD_ID, "title": "My card", "details": ""}},
}

CARD_DATA = {"id": TEST_CARD_ID, "title": "My card", "details": ""}


# --- Auth guard ---

def test_get_board_unauthenticated(client):
    assert client.get("/api/board").status_code == 401


def test_rename_column_unauthenticated(client):
    assert client.put(f"/api/board/columns/{TEST_COL_ID}", json={"title": "X"}).status_code == 401


def test_create_card_unauthenticated(client):
    assert client.post("/api/board/cards", json={"column_id": TEST_COL_ID, "title": "X"}).status_code == 401


def test_delete_card_unauthenticated(client):
    assert client.delete(f"/api/board/cards/{TEST_CARD_ID}").status_code == 401


def test_update_card_unauthenticated(client):
    assert client.put(f"/api/board/cards/{TEST_CARD_ID}", json={"title": "X", "details": ""}).status_code == 401


def test_move_card_unauthenticated(client):
    assert client.put(f"/api/board/cards/{TEST_CARD_ID}/move", json={"column_id": TEST_COL_ID, "position": 0}).status_code == 401


# --- Board CRUD ---

def test_get_board(client, auth_headers):
    with patch("db.fetch_board", new=AsyncMock(return_value=BOARD_DATA)):
        resp = client.get("/api/board", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == BOARD_DATA


def test_rename_column(client, auth_headers):
    with patch("db.rename_column", new=AsyncMock(return_value=True)):
        resp = client.put(
            f"/api/board/columns/{TEST_COL_ID}",
            json={"title": "New Name"},
            headers=auth_headers,
        )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_rename_column_not_found(client, auth_headers):
    with patch("db.rename_column", new=AsyncMock(return_value=False)):
        resp = client.put(
            f"/api/board/columns/{TEST_COL_ID}",
            json={"title": "X"},
            headers=auth_headers,
        )
    assert resp.status_code == 404


def test_create_card(client, auth_headers):
    with patch("db.create_card", new=AsyncMock(return_value=CARD_DATA)):
        resp = client.post(
            "/api/board/cards",
            json={"column_id": TEST_COL_ID, "title": "My card", "details": ""},
            headers=auth_headers,
        )
    assert resp.status_code == 201
    assert resp.json()["title"] == "My card"


def test_create_card_column_not_found(client, auth_headers):
    with patch("db.create_card", new=AsyncMock(return_value=None)):
        resp = client.post(
            "/api/board/cards",
            json={"column_id": TEST_COL_ID, "title": "X"},
            headers=auth_headers,
        )
    assert resp.status_code == 404


def test_update_card(client, auth_headers):
    updated = {**CARD_DATA, "title": "Updated", "details": "New details"}
    with patch("db.update_card", new=AsyncMock(return_value=updated)):
        resp = client.put(
            f"/api/board/cards/{TEST_CARD_ID}",
            json={"title": "Updated", "details": "New details"},
            headers=auth_headers,
        )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated"


def test_update_card_not_found(client, auth_headers):
    with patch("db.update_card", new=AsyncMock(return_value=None)):
        resp = client.put(
            f"/api/board/cards/{TEST_CARD_ID}",
            json={"title": "X", "details": ""},
            headers=auth_headers,
        )
    assert resp.status_code == 404


def test_delete_card(client, auth_headers):
    with patch("db.delete_card", new=AsyncMock(return_value=True)):
        resp = client.delete(f"/api/board/cards/{TEST_CARD_ID}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_delete_card_not_found(client, auth_headers):
    with patch("db.delete_card", new=AsyncMock(return_value=False)):
        resp = client.delete(f"/api/board/cards/{TEST_CARD_ID}", headers=auth_headers)
    assert resp.status_code == 404


def test_move_card(client, auth_headers):
    with patch("db.move_card", new=AsyncMock(return_value=True)):
        resp = client.put(
            f"/api/board/cards/{TEST_CARD_ID}/move",
            json={"column_id": TEST_COL_ID, "position": 0},
            headers=auth_headers,
        )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_move_card_not_found(client, auth_headers):
    with patch("db.move_card", new=AsyncMock(return_value=False)):
        resp = client.put(
            f"/api/board/cards/{TEST_CARD_ID}/move",
            json={"column_id": TEST_COL_ID, "position": 0},
            headers=auth_headers,
        )
    assert resp.status_code == 404

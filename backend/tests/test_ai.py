from unittest.mock import AsyncMock, patch

import pytest

from tests.conftest import TEST_CARD_ID, TEST_COL_ID, TEST_USER_ID

BOARD_DATA = {
    "columns": [{"id": TEST_COL_ID, "title": "Backlog", "cardIds": [TEST_CARD_ID]}],
    "cards": {TEST_CARD_ID: {"id": TEST_CARD_ID, "title": "Existing card", "details": ""}},
}


def _ai_response(message="ok", board_update=None):
    from ai import AiResponse, BoardUpdate
    upd = BoardUpdate(**board_update) if board_update else None
    return AiResponse(message=message, board_update=upd)


# --- Auth guard ---

def test_chat_unauthenticated(client):
    resp = client.post("/api/ai/chat", json={"message": "hello"})
    assert resp.status_code == 401


# --- Basic chat (no board changes) ---

def test_chat_returns_message(client, auth_headers):
    with (
        patch("db.fetch_board", new=AsyncMock(return_value=BOARD_DATA)),
        patch("ai.chat_with_board", new=AsyncMock(return_value=_ai_response("Hello!"))),
    ):
        resp = client.post("/api/ai/chat", json={"message": "hi"}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["message"] == "Hello!"
    assert body["board_updated"] is False


def test_chat_null_board_update_is_not_updated(client, auth_headers):
    with (
        patch("db.fetch_board", new=AsyncMock(return_value=BOARD_DATA)),
        patch("ai.chat_with_board", new=AsyncMock(return_value=_ai_response("Sure", board_update=None))),
    ):
        resp = client.post("/api/ai/chat", json={"message": "what cards exist?"}, headers=auth_headers)
    assert resp.json()["board_updated"] is False


def test_chat_empty_board_update_lists_not_flagged(client, auth_headers):
    """board_update present but all lists empty → board_updated: false."""
    with (
        patch("db.fetch_board", new=AsyncMock(return_value=BOARD_DATA)),
        patch(
            "ai.chat_with_board",
            new=AsyncMock(
                return_value=_ai_response(
                    "Done",
                    board_update={
                        "cards_to_create": [],
                        "cards_to_move": [],
                        "cards_to_update": [],
                        "cards_to_delete": [],
                    },
                )
            ),
        ),
    ):
        resp = client.post("/api/ai/chat", json={"message": "do nothing"}, headers=auth_headers)
    assert resp.json()["board_updated"] is False


# --- Board mutations ---

def test_chat_creates_card(client, auth_headers):
    upd = {
        "cards_to_create": [{"column_id": TEST_COL_ID, "title": "New task", "details": ""}],
        "cards_to_move": [],
        "cards_to_update": [],
        "cards_to_delete": [],
    }
    new_card = {"id": "dddddddd-dddd-dddd-dddd-dddddddddddd", "title": "New task", "details": ""}
    with (
        patch("db.fetch_board", new=AsyncMock(return_value=BOARD_DATA)),
        patch("ai.chat_with_board", new=AsyncMock(return_value=_ai_response("Created!", board_update=upd))),
        patch("db.create_card", new=AsyncMock(return_value=new_card)) as mock_create,
    ):
        resp = client.post("/api/ai/chat", json={"message": "add a card"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["board_updated"] is True
    mock_create.assert_awaited_once_with(None, TEST_COL_ID, "New task", "", TEST_USER_ID)


def test_chat_moves_card(client, auth_headers):
    target_col = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
    upd = {
        "cards_to_create": [],
        "cards_to_move": [{"card_id": TEST_CARD_ID, "column_id": target_col, "position": 0}],
        "cards_to_update": [],
        "cards_to_delete": [],
    }
    with (
        patch("db.fetch_board", new=AsyncMock(return_value=BOARD_DATA)),
        patch("ai.chat_with_board", new=AsyncMock(return_value=_ai_response("Moved!", board_update=upd))),
        patch("db.move_card", new=AsyncMock(return_value=True)) as mock_move,
    ):
        resp = client.post("/api/ai/chat", json={"message": "move it"}, headers=auth_headers)
    assert resp.json()["board_updated"] is True
    mock_move.assert_awaited_once_with(None, TEST_CARD_ID, target_col, 0, TEST_USER_ID)


def test_chat_updates_card(client, auth_headers):
    upd = {
        "cards_to_create": [],
        "cards_to_move": [],
        "cards_to_update": [{"card_id": TEST_CARD_ID, "title": "Renamed", "details": "New details"}],
        "cards_to_delete": [],
    }
    with (
        patch("db.fetch_board", new=AsyncMock(return_value=BOARD_DATA)),
        patch("ai.chat_with_board", new=AsyncMock(return_value=_ai_response("Updated!", board_update=upd))),
        patch("db.update_card", new=AsyncMock(return_value={"id": TEST_CARD_ID, "title": "Renamed", "details": "New details"})) as mock_update,
    ):
        resp = client.post("/api/ai/chat", json={"message": "rename it"}, headers=auth_headers)
    assert resp.json()["board_updated"] is True
    mock_update.assert_awaited_once_with(None, TEST_CARD_ID, "Renamed", "New details", TEST_USER_ID)


def test_chat_update_card_falls_back_to_existing_fields(client, auth_headers):
    """When AI omits title/details, falls back to current values from board."""
    upd = {
        "cards_to_create": [],
        "cards_to_move": [],
        "cards_to_update": [{"card_id": TEST_CARD_ID, "title": None, "details": None}],
        "cards_to_delete": [],
    }
    with (
        patch("db.fetch_board", new=AsyncMock(return_value=BOARD_DATA)),
        patch("ai.chat_with_board", new=AsyncMock(return_value=_ai_response("Done", board_update=upd))),
        patch("db.update_card", new=AsyncMock(return_value={"id": TEST_CARD_ID, "title": "Existing card", "details": ""})) as mock_update,
    ):
        client.post("/api/ai/chat", json={"message": "update"}, headers=auth_headers)
    mock_update.assert_awaited_once_with(None, TEST_CARD_ID, "Existing card", "", TEST_USER_ID)


def test_chat_deletes_card(client, auth_headers):
    upd = {
        "cards_to_create": [],
        "cards_to_move": [],
        "cards_to_update": [],
        "cards_to_delete": [TEST_CARD_ID],
    }
    with (
        patch("db.fetch_board", new=AsyncMock(return_value=BOARD_DATA)),
        patch("ai.chat_with_board", new=AsyncMock(return_value=_ai_response("Deleted!", board_update=upd))),
        patch("db.delete_card", new=AsyncMock(return_value=True)) as mock_delete,
    ):
        resp = client.post("/api/ai/chat", json={"message": "delete it"}, headers=auth_headers)
    assert resp.json()["board_updated"] is True
    mock_delete.assert_awaited_once_with(None, TEST_CARD_ID, TEST_USER_ID)


# --- Error handling ---

def test_chat_missing_api_key_returns_503(client, auth_headers):
    with (
        patch("db.fetch_board", new=AsyncMock(return_value=BOARD_DATA)),
        patch("ai.chat_with_board", new=AsyncMock(side_effect=ValueError("OPENROUTER_API_KEY is not set"))),
    ):
        resp = client.post("/api/ai/chat", json={"message": "hi"}, headers=auth_headers)
    assert resp.status_code == 503
    assert "OPENROUTER_API_KEY" in resp.json()["detail"]


# --- History passthrough ---

def test_chat_passes_history_to_ai(client, auth_headers):
    history = [
        {"role": "user", "content": "What columns exist?"},
        {"role": "assistant", "content": "Backlog, Done, ..."},
    ]
    with (
        patch("db.fetch_board", new=AsyncMock(return_value=BOARD_DATA)),
        patch("ai.chat_with_board", new=AsyncMock(return_value=_ai_response("Got it"))) as mock_chat,
    ):
        client.post(
            "/api/ai/chat",
            json={"message": "thanks", "history": history},
            headers=auth_headers,
        )
    mock_chat.assert_awaited_once_with(BOARD_DATA, history, "thanks")

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Header
from fastapi.responses import FileResponse
from pydantic import BaseModel

import auth as auth_module
import db
import ai as ai_module

STATIC_DIR = Path("static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_pool()
    await db.init_db(db.get_pool())
    yield
    await db.close_pool()


app = FastAPI(lifespan=lifespan)


# --- Auth dependency ---

async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.removeprefix("Bearer ")
    user_id = auth_module.get_user_id(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user_id


# --- Auth routes ---

class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/auth/login")
async def login(body: LoginRequest, pool=Depends(db.get_pool)):
    if body.username != auth_module.VALID_USERNAME or body.password != auth_module.VALID_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user = await db.get_user(pool, body.username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    token = auth_module.create_session(str(user["id"]))
    return {"token": token}


@app.post("/api/auth/logout")
async def logout(
    authorization: Annotated[str | None, Header()] = None,
    user_id: str = Depends(get_current_user),
):
    token = (authorization or "").removeprefix("Bearer ")
    auth_module.delete_session(token)
    return {"ok": True}


# --- Board request models ---

class RenameColumnRequest(BaseModel):
    title: str


class CreateCardRequest(BaseModel):
    column_id: str
    title: str
    details: str = ""


class UpdateCardRequest(BaseModel):
    title: str
    details: str


class MoveCardRequest(BaseModel):
    column_id: str
    position: int


# --- Health ---

@app.get("/api/health")
def health():
    return {"status": "ok"}


# --- Board routes ---

@app.get("/api/board")
async def get_board(
    user_id: str = Depends(get_current_user),
    pool=Depends(db.get_pool),
):
    return await db.fetch_board(pool, user_id)


@app.put("/api/board/columns/{column_id}")
async def rename_column(
    column_id: str,
    body: RenameColumnRequest,
    user_id: str = Depends(get_current_user),
    pool=Depends(db.get_pool),
):
    ok = await db.rename_column(pool, column_id, body.title, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Column not found")
    return {"ok": True}


@app.post("/api/board/cards", status_code=201)
async def create_card(
    body: CreateCardRequest,
    user_id: str = Depends(get_current_user),
    pool=Depends(db.get_pool),
):
    card = await db.create_card(pool, body.column_id, body.title, body.details, user_id)
    if not card:
        raise HTTPException(status_code=404, detail="Column not found")
    return card


@app.put("/api/board/cards/{card_id}")
async def update_card(
    card_id: str,
    body: UpdateCardRequest,
    user_id: str = Depends(get_current_user),
    pool=Depends(db.get_pool),
):
    card = await db.update_card(pool, card_id, body.title, body.details, user_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@app.delete("/api/board/cards/{card_id}")
async def delete_card(
    card_id: str,
    user_id: str = Depends(get_current_user),
    pool=Depends(db.get_pool),
):
    ok = await db.delete_card(pool, card_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"ok": True}


@app.put("/api/board/cards/{card_id}/move")
async def move_card(
    card_id: str,
    body: MoveCardRequest,
    user_id: str = Depends(get_current_user),
    pool=Depends(db.get_pool),
):
    ok = await db.move_card(pool, card_id, body.column_id, body.position, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"ok": True}


# --- AI routes ---

@app.post("/api/ai/test")
async def ai_test():
    try:
        answer = await ai_module.call_ai([{"role": "user", "content": "What is 2+2? Reply with just the number."}])
        return {"response": answer}
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@app.post("/api/ai/chat")
async def ai_chat(
    body: ChatRequest,
    user_id: str = Depends(get_current_user),
    pool=Depends(db.get_pool),
):
    try:
        board = await db.fetch_board(pool, user_id)
        ai_resp = await ai_module.chat_with_board(board, body.history, body.message)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    board_updated = False
    if ai_resp.board_update:
        upd = ai_resp.board_update
        has_ops = bool(
            upd.cards_to_create
            or upd.cards_to_move
            or upd.cards_to_update
            or upd.cards_to_delete
        )
        if has_ops:
            board_updated = True
            for card in upd.cards_to_create:
                await db.create_card(pool, card.column_id, card.title, card.details, user_id)
            for move in upd.cards_to_move:
                await db.move_card(pool, move.card_id, move.column_id, move.position, user_id)
            for update in upd.cards_to_update:
                existing = board["cards"].get(update.card_id, {})
                title = update.title if update.title is not None else existing.get("title", "")
                details = update.details if update.details is not None else existing.get("details", "")
                await db.update_card(pool, update.card_id, title, details, user_id)
            for card_id in upd.cards_to_delete:
                await db.delete_card(pool, card_id, user_id)

    return {"message": ai_resp.message, "board_updated": board_updated}


# --- Static file serving (catch-all, must be last) ---

@app.get("/{full_path:path}")
def serve_frontend(full_path: str):
    candidate = STATIC_DIR / full_path
    if candidate.is_file():
        return FileResponse(candidate)
    index = STATIC_DIR / full_path / "index.html"
    if index.is_file():
        return FileResponse(index)
    return FileResponse(STATIC_DIR / "index.html")

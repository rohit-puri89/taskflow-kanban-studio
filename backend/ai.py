import json
import os

from openai import AsyncOpenAI
from pydantic import BaseModel

MODEL = "openai/gpt-oss-120b:free"

SYSTEM_PROMPT = """You are a helpful Kanban board assistant. You can answer questions about the board and make changes to it on behalf of the user.

Always respond with a JSON object in exactly this format — no markdown, no prose outside the JSON:

{
  "message": "<your reply to the user>",
  "board_update": null
}

Or, when the user asks you to change the board:

{
  "message": "<your reply to the user>",
  "board_update": {
    "cards_to_create": [{"column_id": "<exact id from board>", "title": "<title>", "details": "<details or empty string>"}],
    "cards_to_move":   [{"card_id": "<exact id>", "column_id": "<exact id>", "position": <0-based int>}],
    "cards_to_update": [{"card_id": "<exact id>", "title": "<new title>", "details": "<new details>"}],
    "cards_to_delete": ["<exact card id>"]
  }
}

Rules:
- Use null for board_update when no board changes are needed.
- When board_update is set, include all four lists (use [] for unused operations).
- Use exact column IDs and card IDs from the board state — never invent IDs.
- Only modify the board when the user explicitly asks.
- New cards are appended to the end of the column; you do not control position for creates.
- For moves, position is 0-based within the target column.
- Be friendly and concise.
"""


class CardToCreate(BaseModel):
    column_id: str
    title: str
    details: str = ""


class CardToMove(BaseModel):
    card_id: str
    column_id: str
    position: int


class CardToUpdate(BaseModel):
    card_id: str
    title: str | None = None
    details: str | None = None


class BoardUpdate(BaseModel):
    cards_to_create: list[CardToCreate] = []
    cards_to_move: list[CardToMove] = []
    cards_to_update: list[CardToUpdate] = []
    cards_to_delete: list[str] = []


class AiResponse(BaseModel):
    message: str
    board_update: BoardUpdate | None = None


_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY is not set")
        _client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
        )
    return _client


def _extract_json(text: str) -> dict:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    return {"message": text}


async def call_ai(messages: list[dict]) -> str:
    client = get_client()
    response = await client.chat.completions.create(
        model=MODEL,
        messages=messages,
    )
    return response.choices[0].message.content or ""


async def chat_with_board(
    board: dict, history: list[dict], message: str
) -> AiResponse:
    client = get_client()

    board_json = json.dumps(board, indent=2)
    system_content = f"{SYSTEM_PROMPT}\n\nCurrent board state:\n{board_json}"

    messages = [
        {"role": "system", "content": system_content},
        *history,
        {"role": "user", "content": message},
    ]

    response = await client.chat.completions.create(
        model=MODEL,
        messages=messages,
    )

    raw = response.choices[0].message.content or ""
    data = _extract_json(raw)
    try:
        return AiResponse.model_validate(data)
    except Exception:
        return AiResponse(message=raw)

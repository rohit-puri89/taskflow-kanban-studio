import os

import asyncpg

_pool: asyncpg.Pool | None = None

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/kanban"
)

_DEFAULT_COLUMNS = ["Backlog", "Discovery", "In Progress", "Review", "Done"]


async def init_pool() -> None:
    global _pool
    import asyncio
    last_error = None
    for attempt in range(10):
        try:
            _pool = await asyncpg.create_pool(DATABASE_URL)
            return
        except Exception as exc:
            last_error = exc
            await asyncio.sleep(2)
    raise RuntimeError(f"Could not connect to database after 10 attempts: {last_error}")


async def close_pool() -> None:
    if _pool:
        await _pool.close()


def get_pool() -> asyncpg.Pool:
    return _pool


async def init_db(pool: asyncpg.Pool) -> None:
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                username      TEXT        NOT NULL UNIQUE,
                password_hash TEXT        NOT NULL DEFAULT '',
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS boards (
                id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name       TEXT        NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS columns (
                id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                board_id   UUID        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
                title      TEXT        NOT NULL,
                position   INTEGER     NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS cards (
                id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                column_id  UUID        NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
                title      TEXT        NOT NULL,
                details    TEXT        NOT NULL DEFAULT '',
                position   INTEGER     NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)

        user = await conn.fetchrow("SELECT id FROM users WHERE username = 'user'")
        if not user:
            user = await conn.fetchrow(
                "INSERT INTO users (username) VALUES ('user') RETURNING id"
            )
            board = await conn.fetchrow(
                "INSERT INTO boards (user_id, name) VALUES ($1, 'My Board') RETURNING id",
                user["id"],
            )
            for i, title in enumerate(_DEFAULT_COLUMNS):
                await conn.execute(
                    "INSERT INTO columns (board_id, title, position) VALUES ($1, $2, $3)",
                    board["id"], title, i,
                )


async def get_user(pool: asyncpg.Pool, username: str):
    async with pool.acquire() as conn:
        return await conn.fetchrow(
            "SELECT id, username FROM users WHERE username = $1", username
        )


async def fetch_board(pool: asyncpg.Pool, user_id: str) -> dict:
    async with pool.acquire() as conn:
        board = await conn.fetchrow(
            "SELECT id FROM boards WHERE user_id = $1::uuid LIMIT 1", user_id
        )
        if not board:
            return {"columns": [], "cards": {}}

        cols = await conn.fetch(
            "SELECT id, title FROM columns WHERE board_id = $1 ORDER BY position",
            board["id"],
        )
        col_ids = [r["id"] for r in cols]

        card_rows = (
            await conn.fetch(
                "SELECT id, column_id, title, details FROM cards "
                "WHERE column_id = ANY($1) ORDER BY column_id, position",
                col_ids,
            )
            if col_ids
            else []
        )

        cards_by_col: dict[str, list[str]] = {}
        for row in card_rows:
            cards_by_col.setdefault(str(row["column_id"]), []).append(str(row["id"]))

        return {
            "columns": [
                {
                    "id": str(c["id"]),
                    "title": c["title"],
                    "cardIds": cards_by_col.get(str(c["id"]), []),
                }
                for c in cols
            ],
            "cards": {
                str(r["id"]): {
                    "id": str(r["id"]),
                    "title": r["title"],
                    "details": r["details"],
                }
                for r in card_rows
            },
        }


async def rename_column(
    pool: asyncpg.Pool, column_id: str, title: str, user_id: str
) -> bool:
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE columns SET title = $1
            WHERE id = $2::uuid
              AND board_id IN (SELECT id FROM boards WHERE user_id = $3::uuid)
            """,
            title, column_id, user_id,
        )
        return result == "UPDATE 1"


async def create_card(
    pool: asyncpg.Pool, column_id: str, title: str, details: str, user_id: str
) -> dict | None:
    async with pool.acquire() as conn:
        async with conn.transaction():
            col = await conn.fetchrow(
                """
                SELECT c.id FROM columns c
                JOIN boards b ON b.id = c.board_id
                WHERE c.id = $1::uuid AND b.user_id = $2::uuid
                """,
                column_id, user_id,
            )
            if not col:
                return None

            max_pos = await conn.fetchval(
                "SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = $1::uuid",
                column_id,
            )
            card = await conn.fetchrow(
                """
                INSERT INTO cards (column_id, title, details, position)
                VALUES ($1::uuid, $2, $3, $4)
                RETURNING id, title, details
                """,
                column_id, title, details, max_pos + 1,
            )
            return {"id": str(card["id"]), "title": card["title"], "details": card["details"]}


async def update_card(
    pool: asyncpg.Pool, card_id: str, title: str, details: str, user_id: str
) -> dict | None:
    async with pool.acquire() as conn:
        card = await conn.fetchrow(
            """
            UPDATE cards SET title = $1, details = $2
            WHERE id = $3::uuid
              AND column_id IN (
                SELECT c.id FROM columns c
                JOIN boards b ON b.id = c.board_id
                WHERE b.user_id = $4::uuid
              )
            RETURNING id, title, details
            """,
            title, details, card_id, user_id,
        )
        if not card:
            return None
        return {"id": str(card["id"]), "title": card["title"], "details": card["details"]}


async def delete_card(pool: asyncpg.Pool, card_id: str, user_id: str) -> bool:
    async with pool.acquire() as conn:
        async with conn.transaction():
            card = await conn.fetchrow(
                """
                SELECT id, column_id, position FROM cards
                WHERE id = $1::uuid
                  AND column_id IN (
                    SELECT c.id FROM columns c
                    JOIN boards b ON b.id = c.board_id
                    WHERE b.user_id = $2::uuid
                  )
                """,
                card_id, user_id,
            )
            if not card:
                return False

            await conn.execute("DELETE FROM cards WHERE id = $1", card["id"])
            await conn.execute(
                "UPDATE cards SET position = position - 1 WHERE column_id = $1 AND position > $2",
                card["column_id"], card["position"],
            )
            return True


async def move_card(
    pool: asyncpg.Pool,
    card_id: str,
    target_column_id: str,
    target_position: int,
    user_id: str,
) -> bool:
    async with pool.acquire() as conn:
        async with conn.transaction():
            card = await conn.fetchrow(
                """
                SELECT c.id, c.column_id, c.position FROM cards c
                JOIN columns col ON col.id = c.column_id
                JOIN boards b ON b.id = col.board_id
                WHERE c.id = $1::uuid AND b.user_id = $2::uuid
                """,
                card_id, user_id,
            )
            if not card:
                return False

            target_col = await conn.fetchrow(
                """
                SELECT col.id FROM columns col
                JOIN boards b ON b.id = col.board_id
                WHERE col.id = $1::uuid AND b.user_id = $2::uuid
                """,
                target_column_id, user_id,
            )
            if not target_col:
                return False

            src_col = card["column_id"]
            src_pos = card["position"]

            if str(src_col) == target_column_id:
                if src_pos == target_position:
                    return True
                elif src_pos < target_position:
                    await conn.execute(
                        "UPDATE cards SET position = position - 1 "
                        "WHERE column_id = $1 AND position > $2 AND position <= $3",
                        src_col, src_pos, target_position,
                    )
                else:
                    await conn.execute(
                        "UPDATE cards SET position = position + 1 "
                        "WHERE column_id = $1 AND position >= $2 AND position < $3",
                        src_col, target_position, src_pos,
                    )
                await conn.execute(
                    "UPDATE cards SET position = $1 WHERE id = $2",
                    target_position, card["id"],
                )
            else:
                await conn.execute(
                    "UPDATE cards SET position = position - 1 "
                    "WHERE column_id = $1 AND position > $2",
                    src_col, src_pos,
                )
                await conn.execute(
                    "UPDATE cards SET position = position + 1 "
                    "WHERE column_id = $1::uuid AND position >= $2",
                    target_column_id, target_position,
                )
                await conn.execute(
                    "UPDATE cards SET column_id = $1::uuid, position = $2 WHERE id = $3",
                    target_column_id, target_position, card["id"],
                )
            return True

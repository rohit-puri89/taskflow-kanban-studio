# Project Plan

---

## Part 1: Plan

Enrich this document with detailed substeps and success criteria. Create `frontend/AGENTS.md` describing the existing frontend code.

- [x] Review existing frontend code
- [x] Create `frontend/AGENTS.md`
- [x] Enrich this plan with substeps, checklists, and success criteria
- [x] User reviews and approves plan

**Success criteria:** User has signed off on this plan before any code is written.

---

## Part 2: Scaffolding

Set up Docker infrastructure, FastAPI backend skeleton, and start/stop scripts. Confirm a "hello world" page and a test API call both work inside Docker.

- [x] Create `backend/main.py` — FastAPI app with a single `GET /api/health` endpoint returning `{"status": "ok"}`
- [x] Create `backend/pyproject.toml` for uv with FastAPI and uvicorn as dependencies
- [x] Create `Dockerfile` at project root
  - [x] Python base image, install deps via uv
  - [x] Copy a placeholder `static/index.html` (Hello World)
  - [x] FastAPI serves static HTML at `/` via `StaticFiles`
  - [x] Expose port 8000, CMD runs uvicorn
- [x] Create `scripts/start.sh` (Mac/Linux) — builds image, runs container with port mapping
- [x] Create `scripts/start.bat` (Windows) — same as above
- [x] Create `scripts/stop.sh` and `scripts/stop.bat` — stop and remove the container

**Success criteria:**
- `docker build` completes without errors
- `scripts/start.sh` starts the container
- `curl http://localhost:8000/` returns Hello World HTML
- `curl http://localhost:8000/api/health` returns `{"status": "ok"}`
- `scripts/stop.sh` stops the container cleanly

---

## Part 3: Add Frontend

Replace the placeholder HTML with the real Next.js frontend, statically built and served by FastAPI.

- [x] Add `output: 'export'` to `frontend/next.config.ts` for static export
- [x] Update `Dockerfile` to run `npm ci && npm run build` inside `frontend/`
- [x] Copy `frontend/out/` into the Docker image, replacing the placeholder static dir
- [x] Update FastAPI static file mount to serve from the Next.js export directory
- [x] Add a catch-all route in FastAPI to serve `index.html` for any unmatched path (supports client-side routing)
- [x] Verify fonts and Tailwind CSS are included in the static export

**Success criteria:**
- `docker build` completes
- `http://localhost:8000/` shows the Kanban board, not a placeholder
- Drag-and-drop works in the browser
- Column rename works
- Add card and delete card work
- No console errors in the browser

---

## Part 4: Fake User Sign In

Protect the Kanban behind a login screen. Credentials are hardcoded (`user` / `password`). Auth state persists across page refreshes via `sessionStorage`.

- [x] Create `frontend/src/lib/auth.ts` with `login(username, password): boolean`, `logout()`, `isAuthenticated(): boolean`
  - [x] `login()` checks against hardcoded values, stores a flag in `sessionStorage` on success
  - [x] `logout()` clears `sessionStorage`
  - [x] `isAuthenticated()` reads from `sessionStorage`
- [x] Create `frontend/src/app/login/page.tsx` — login form with username, password fields, and a submit button
  - [x] Shows an error message on wrong credentials
  - [x] Redirects to `/` on success using Next.js router
- [x] Update `frontend/src/app/page.tsx` to redirect to `/login` if not authenticated
- [x] Add a logout button to the `KanbanBoard` header that calls `logout()` and redirects to `/login`
- [x] Unit tests for `auth.ts` (login, logout, isAuthenticated)
- [x] Unit test for login form (renders, submits, error on bad credentials)

**Success criteria:**
- `http://localhost:8000/` redirects to `/login` when not logged in
- Correct credentials land the user on the Kanban board
- Wrong credentials show an error, no redirect
- Logout returns to `/login`
- Refreshing while logged in stays on the board
- Refreshing while logged out stays on `/login`

---

## Part 5: Database Modeling

Design and document the Postgres schema. Get user sign-off before writing any DB code.

- [x] Design schema covering `users`, `boards`, `columns`, `cards` tables
  - [x] `users`: `id`, `username`, `password_hash` (supports real auth in future)
  - [x] `boards`: `id`, `user_id`, `name`
  - [x] `columns`: `id`, `board_id`, `title`, `position` (integer, determines display order)
  - [x] `cards`: `id`, `column_id`, `title`, `details`, `position`
- [x] Save schema as `docs/schema.json`
- [x] Write `docs/database.md` — table relationships, key design decisions, how position ordering works
- [x] Present to user for approval

**Success criteria:**
- User approves the schema before Part 6 begins
- Schema supports future multi-user, multi-board use without structural changes

---

## Part 6: Backend API

Add FastAPI routes for reading and mutating the Kanban board. Use Supabase local Postgres as the database; create tables on startup if they don't exist.

- [x] Configure Supabase local (via `docker-compose.yml` or Supabase CLI) — Postgres runs alongside the app container
- [x] Add DB connection in `backend/db.py` using `asyncpg`
- [x] On FastAPI startup, run `CREATE TABLE IF NOT EXISTS` for all tables, seed initial board for user `user` if empty
- [x] Implement auth endpoints:
  - [x] `POST /api/auth/login` — validates hardcoded creds, returns a session token (stored in server-side dict for MVP)
  - [x] `POST /api/auth/logout` — invalidates session token
- [x] Add auth middleware: all `/api/board/*` routes require a valid session token in the `Authorization` header
- [x] Implement board endpoints (all scoped to the authenticated user):
  - [x] `GET /api/board` — returns full board: columns in position order, cards per column in position order
  - [x] `PUT /api/board/columns/{column_id}` — rename a column
  - [x] `POST /api/board/cards` — create a card in a column (body: `column_id`, `title`, `details`)
  - [x] `DELETE /api/board/cards/{card_id}` — delete a card
  - [x] `PUT /api/board/cards/{card_id}` — update card title or details
  - [x] `PUT /api/board/cards/{card_id}/move` — move card to a new column and position
- [x] Pytest unit tests for all routes

**Success criteria:**
- `GET /api/board` returns a shape matching the frontend's `BoardData` type
- Column rename, card create/delete/move all persist after container restart
- Unauthenticated requests to `/api/board/*` return 401
- DB tables are created automatically on first run — no manual setup required
- All pytest tests pass

---

## Part 7: Frontend + Backend Integration

Replace all in-memory state in the frontend with real API calls. The board is now persistent.

- [x] Update `frontend/src/lib/auth.ts` — `login()` calls `POST /api/auth/login`, stores token; `logout()` calls `POST /api/auth/logout`
- [x] Create `frontend/src/lib/api.ts` — typed fetch wrappers for all board endpoints, attaches auth token to every request
- [x] Update `KanbanBoard.tsx` — fetch board from `GET /api/board` on mount; show loading state; show error state if fetch fails
- [x] Remove `initialData` import — board state is seeded by the backend
- [x] Wire all mutations to API calls:
  - [x] Column rename → `PUT /api/board/columns/{id}`
  - [x] Add card → `POST /api/board/cards`
  - [x] Delete card → `DELETE /api/board/cards/{id}`
  - [x] Drag-and-drop → `PUT /api/board/cards/{id}/move`
- [x] Apply optimistic UI updates: change state immediately, revert on API error
- [x] Unit tests for `api.ts` with mocked fetch
- [x] Playwright integration tests covering add, move, rename, delete

**Success criteria:**
- Add a card, refresh the page — card is still there
- Move a card to another column, refresh — card is in the new column
- Rename a column, refresh — new name persists
- Delete a card, refresh — card is gone
- All Playwright tests pass

---

## Part 8: AI Connectivity

Connect the backend to OpenRouter. Smoke-test with a simple prompt before building full chat.

- [x] Add `OPENROUTER_API_KEY` to `.env.example` and read it from environment in the app
- [x] Create `backend/ai.py` — `call_ai(messages: list) -> str` using the `openai` Python SDK pointed at the OpenRouter base URL, model `openai/gpt-oss-120b:free`
- [x] Add `POST /api/ai/test` endpoint — sends `"What is 2+2?"` and returns the AI's response
- [x] Confirm the API key is never hardcoded — only read from environment

**Success criteria:**
- `POST /api/ai/test` returns a response containing "4"
- If `OPENROUTER_API_KEY` is missing, the endpoint returns a clear error response, not a crash
- No API key appears in any committed file

---

## Part 9: AI with Kanban Context and Structured Outputs

Every AI call receives the full board state and conversation history. The AI returns a structured response that includes its reply and an optional board update.

- [x] Define `AiResponse` Pydantic model:
  ```
  message: str
  board_update: null | {
    cards_to_create: [{ column_id, title, details }]
    cards_to_move:   [{ card_id, column_id, position }]
    cards_to_update: [{ card_id, title?, details? }]
    cards_to_delete: [card_id]
  }
  ```
- [x] Update `backend/ai.py` — accept board JSON + conversation history, build system prompt with board context, request structured output, parse into `AiResponse`
- [x] Document the system prompt in `backend/ai.py` as a module-level constant
- [x] Add `POST /api/ai/chat` endpoint:
  - [x] Body: `{ "message": string, "history": [{ "role": string, "content": string }] }`
  - [x] Fetches current board for authenticated user
  - [x] Calls AI with board + history + new message
  - [x] Applies any `board_update` to the DB
  - [x] Returns `{ "message": string, "board_updated": boolean }`
- [x] Pytest tests for the chat endpoint

**Success criteria:**
- `POST /api/ai/chat` with "Add a card called Test to Backlog" → card appears in the DB
- `POST /api/ai/chat` with "Move Test to Done" → card is in Done column in the DB
- `POST /api/ai/chat` with "What cards are in Backlog?" → correct answer, no DB change
- Multi-turn conversation works (history is passed and used)

---

## Part 10: AI Sidebar UI

Add a polished AI chat sidebar to the Kanban UI. If the AI updates the board, the UI refreshes automatically without a page reload.

- [x] Create `frontend/src/components/AiSidebar.tsx`:
  - [x] Scrollable chat history showing user and AI messages
  - [x] Text input and submit button (submit on Enter or button click)
  - [x] Loading indicator while waiting for AI response
  - [x] Styled using the project color scheme (purple submit button, navy text, etc.)
- [x] Add a sidebar toggle button to the `KanbanBoard` header
- [x] Sidebar slides in from the right without reflowing the board columns
- [x] Wire `AiSidebar` to `POST /api/ai/chat`, passing conversation history
- [x] On response with `board_updated: true`, re-fetch board from `GET /api/board` and update board state
- [x] Maintain conversation history in `AiSidebar` component state
- [x] Auto-scroll chat to the latest message after each response
- [x] Playwright e2e test: open sidebar, send a message that creates a card, verify card appears on board

**Success criteria:**
- Submitting a message shows a loading state, then the AI reply
- "Add a card called Foo to Backlog" → card appears on the board without manual refresh
- "Move Foo to Done" → card moves on the board without manual refresh
- Chat history is preserved when toggling the sidebar open and closed
- Playwright e2e test passes

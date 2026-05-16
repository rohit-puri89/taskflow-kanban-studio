# How We Built This: A Plain-English Guide

This document explains the decisions and approach behind the Project Management App — step by step, in plain language. No coding experience required.

---

## What Is This App?

A **Kanban board** — the same kind of board you'd use in Trello or Jira. You sign in, and you see your tasks organized into columns: Backlog, Discovery, In Progress, Review, and Done. You can drag cards between columns, rename columns, add new cards, and eventually ask an AI to help you manage the board.

The final version will also have an **AI chat sidebar** where you can type something like "Move the login task to Done" and the AI will update the board for you.

---

## The Big Picture

```
┌─────────────────────────────────────────────────────┐
│                    Your Browser                      │
│                                                     │
│   ┌──────────────────────────────────────────────┐  │
│   │          Kanban Board (Next.js UI)           │  │
│   │   Columns → Cards → Drag & Drop → AI Chat   │  │
│   └──────────────────────────────────────────────┘  │
│                        │                            │
│              http://localhost:8000                  │
└────────────────────────│────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              Docker Container                        │
│                                                     │
│   ┌──────────────────────────────────────────────┐  │
│   │         FastAPI Backend (Python)             │  │
│   │   Serves the UI + handles all API calls      │  │
│   └──────────────────────────────────────────────┘  │
│                        │                            │
│   ┌──────────────────────────────────────────────┐  │
│   │         PostgreSQL Database                  │  │
│   │   Stores users, boards, columns, cards       │  │
│   └──────────────────────────────────────────────┘  │
│                                                     │
│   ┌──────────────────────────────────────────────┐  │
│   │         OpenRouter (AI)                      │  │
│   │   External AI service for the chat feature  │  │
│   └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

Everything except the AI service runs on your own computer inside a single Docker container. Nothing is in the cloud. You own all of it.

---

## The Development Approach

We built this in **10 incremental phases**, each one small enough to test and confirm before moving on. No big-bang releases. Each phase ends with a working, verifiable result.

```
Phase 1: Plan              → Write and approve the plan before writing any code
Phase 2: Scaffolding       → A working Docker container with "hello world"
Phase 3: Add Frontend      → Real Kanban UI inside Docker
Phase 4: Login Screen      → Protect the board behind a login
Phase 5: Database Design   → Design the data storage (in progress)
Phase 6: Backend API       → Real data persisted to a database
Phase 7: Connect UI + API  → Board state survives a page refresh
Phase 8: AI Smoke Test     → Confirm the AI connection works
Phase 9: AI + Board State  → AI reads and updates the board
Phase 10: AI Sidebar UI    → Full chat experience in the browser
```

The guiding principle: **get something working at every step, then add the next layer.**

---

## Phase 1: Writing the Plan First

Before writing a single line of code, we wrote out exactly what we were going to build and got it approved. This sounds obvious, but it's easy to skip — and skipping it is usually why projects drift.

The plan lives in [PLAN.md](PLAN.md). Each phase has:
- A list of concrete tasks
- A "success criteria" section — the specific things you can check to know it's done

---

## Phase 2: The Packaging — Docker

**Docker** is the reason the app runs the same way on every computer, every time. Think of Docker as a sealed box that contains the app, all its dependencies, and everything it needs to run.

```
Without Docker:                    With Docker:
"Works on my machine"          →   Works on every machine
Manual setup steps             →   One command: scripts/start.sh
"Which Python version?"        →   Doesn't matter — it's inside the box
```

### How it works

There are two files that define the container:

**`Dockerfile`** — the recipe for building the box:

```
Step 1: Start with Node.js (to build the frontend)
Step 2: Build the Next.js frontend into static files
Step 3: Switch to Python
Step 4: Install the backend dependencies
Step 5: Copy everything into one image
Step 6: Start the server on port 8000
```

**`docker-compose.yml`** — runs two containers together:

```
┌─────────────────────┐     ┌─────────────────────┐
│   app container     │────▶│   db container       │
│   (Python + UI)     │     │   (PostgreSQL)       │
│   port 8000         │     │   internal only      │
└─────────────────────┘     └─────────────────────┘
```

The `app` container waits for the `db` container to be ready before starting. If the database isn't healthy yet, the app just waits. No manual coordination needed.

### Starting and stopping

```
scripts/start.sh   →  builds and starts both containers
scripts/stop.sh    →  stops and removes them cleanly
```

On Windows, the same scripts exist as `.bat` files.

---

## Phase 3: The Frontend — What You See

The visual interface is built with **Next.js**, a popular framework for building websites. It was built first as a standalone demo (no server, no database) and then wired into the full stack.

```
┌──────────────────────────────────────────────────────┐
│                   Kanban Board                        │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ...      │
│  │ Backlog  │  │Discovery │  │In Progress│           │
│  │          │  │          │  │           │           │
│  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │           │
│  │ │Card 1│ │  │ │Card 3│ │  │ │Card 5│ │           │
│  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │           │
│  │ ┌──────┐ │  │          │  │           │           │
│  │ │Card 2│ │  │  + Add   │  │  + Add   │           │
│  │ └──────┘ │  └──────────┘  └──────────┘           │
│  │  + Add   │                                        │
│  └──────────┘                                        │
└──────────────────────────────────────────────────────┘
```

Key things it supports:
- **Drag and drop** — pick up a card and drop it in a different column or different position
- **Inline rename** — click a column title to rename it
- **Add / remove cards** — each column has an "Add a card" button
- **Responsive layout** — columns scroll horizontally if there are many

The frontend is written in **TypeScript** (JavaScript with types) and styled with **Tailwind CSS** (a system where you apply styles directly in the HTML rather than writing separate style sheets).

---

## Phase 4: Login Screen

Before you can see the board, you have to log in.

```
Browser visits http://localhost:8000/
        │
        ▼
Not logged in? ──Yes──▶ Redirect to /login
        │
       No
        │
        ▼
Show the Kanban board
```

For the MVP, the credentials are hardcoded: username `user`, password `password`. This is intentional — the goal was to get the login flow working first. Real password security can be added later without changing the database structure (the `password_hash` column is already there, just waiting).

### How the login state is stored

When you log in, the app stores a "session token" — a random string that proves you are logged in. This token lives in two places:

- **In the browser**: stored in `sessionStorage` so it survives page refreshes but disappears when you close the tab
- **On the server**: stored in memory alongside your user ID

Every subsequent API call from the browser includes this token. The server checks it before doing anything.

```
Login flow:

Browser                        Server
  │                               │
  │── POST /api/auth/login ───────▶│
  │   { username, password }      │ Checks credentials
  │                               │ Creates session token
  │◀── { token: "abc123..." } ────│
  │                               │
  │  (stores token in browser)    │
  │                               │
  │── GET /api/board ────────────▶│
  │   Authorization: Bearer abc123│ Looks up token → user ID
  │◀── { columns, cards } ────────│
```

---

## Phase 5: Database Design (In Progress)

The database is where the board data actually lives — permanently. Unlike browser memory, the database survives page refreshes, restarts, and anything else.

We chose **PostgreSQL** — the most widely used open-source relational database. It stores data in tables, like a spreadsheet, with strict rules about how tables relate to each other.

### The table structure

The data model mirrors the visual hierarchy of the board:

```
users
 └─── boards          (one board per user, for now)
       └─── columns   (Backlog, Discovery, In Progress, Review, Done)
             └─── cards
```

Concretely, as four linked tables:

```
┌─────────────────┐
│     users       │
│─────────────────│
│ id (unique ID)  │◀─────────────────────────────┐
│ username        │                              │
│ password_hash   │                              │
│ created_at      │                              │
└─────────────────┘                              │
                                                 │
┌─────────────────┐                              │
│     boards      │                              │
│─────────────────│                              │
│ id              │◀──────────────────────┐      │
│ user_id ────────────────────────────────────────┘
│ name            │                       │
│ created_at      │                       │
└─────────────────┘                       │
                                          │
┌─────────────────┐                       │
│    columns      │                       │
│─────────────────│                       │
│ id              │◀──────────────┐       │
│ board_id ──────────────────────────────┘
│ title           │               │
│ position        │               │
│ created_at      │               │
└─────────────────┘               │
                                  │
┌─────────────────┐               │
│     cards       │               │
│─────────────────│               │
│ id              │               │
│ column_id ────────────────────┘
│ title           │
│ details         │
│ position        │
│ created_at      │
└─────────────────┘
```

The arrows show "foreign keys" — links between tables. If you delete a user, their boards, columns, and cards are all deleted automatically (cascade delete).

### Position ordering

Every card has a `position` number (0, 1, 2, ...) that determines where it appears in its column. When you drag a card from position 3 to position 1, the backend renumbers the other cards to keep everything contiguous.

Example — moving the card at position 3 to position 0:

```
Before:   Card A (pos 0) | Card B (pos 1) | Card C (pos 2) | Card D (pos 3)
After:    Card D (pos 0) | Card A (pos 1) | Card B (pos 2) | Card C (pos 3)
```

The same logic applies when a card moves between columns — both the source and destination columns are renumbered.

For the full schema detail, see [database.md](database.md).

---

## Phase 6: Backend API

The backend is built with **FastAPI** — a Python framework for building web APIs. An API is simply a set of URLs that the frontend can call to read or change data.

### What the backend does

1. **Serves the frontend** — when you visit `http://localhost:8000/`, FastAPI returns the Next.js static files
2. **Handles auth** — login and logout endpoints
3. **Manages board data** — read, create, update, move, and delete cards and columns

### The API endpoints

```
Authentication:
  POST /api/auth/login          Sign in → get a session token
  POST /api/auth/logout         Sign out → token deleted

Board:
  GET  /api/board               Fetch the whole board (columns + cards)

Columns:
  PUT  /api/board/columns/{id}  Rename a column

Cards:
  POST   /api/board/cards              Create a new card
  PUT    /api/board/cards/{id}         Edit a card's title or details
  DELETE /api/board/cards/{id}         Delete a card
  PUT    /api/board/cards/{id}/move    Move a card to a different position/column
```

Every board endpoint requires a valid session token. Without one, the server returns `401 Unauthorized` and the frontend redirects you to the login page.

### Data security: user isolation

Every database query filters by the logged-in user's ID. There is no way to accidentally access another user's board — the SQL always includes a `WHERE user_id = ...` clause.

---

## Phase 7: Connecting the Frontend to the Backend

Before this phase, the board data lived only in the browser's memory. After this phase, every action — add card, move card, rename column — makes a real API call that saves the change to the database.

```
Before Phase 7:                   After Phase 7:

Browser                           Browser
  │                                 │
  │  Add card                       │  Add card
  │    ↓                            │    ↓
  │  Update React state             │  POST /api/board/cards
  │  (lost on refresh)              │    ↓
                                    │  Card saved to database
                                    │    ↓
                                    │  Update React state
                                    │  (survives any refresh)
```

**Optimistic updates** — when you add a card, the UI shows it immediately without waiting for the server. If the server call fails (network error, etc.), the UI reverts. This makes the app feel instant.

---

## Phase 8: Connecting to the AI Service

The AI feature uses **OpenRouter** — a service that provides access to many AI models through a single API. The model we use is `openai/gpt-oss-120b:free`.

This phase is just a smoke test: does the connection work? The backend sends "What is 2+2?" and confirms the AI responds with "4". Simple, but it proves the integration is wired up before building the real feature.

The API key is stored in a `.env` file on your local machine — it is never committed to the code repository.

---

## Phase 9: AI That Understands Your Board

This is where it gets interesting. Each AI call includes:

1. **The current board state** — all columns, all cards, their positions
2. **The conversation history** — everything said so far in this session
3. **Your new message** — what you just typed

The AI returns a structured response with two parts:
- A **text reply** (the message shown in the chat)
- An optional **board update** — a list of actions to take (create card, move card, delete card)

```
You type: "Add a card called 'Fix login bug' to Backlog"
                    │
                    ▼
    Backend sends to AI:
    - Your message
    - Full board state (JSON)
    - Conversation history
                    │
                    ▼
    AI responds:
    - message: "Done! I've added 'Fix login bug' to Backlog."
    - board_update:
        cards_to_create: [{ column: Backlog, title: "Fix login bug" }]
                    │
                    ▼
    Backend applies the board update to the database
    Returns { message, board_updated: true }
                    │
                    ▼
    Frontend re-fetches the board and shows the new card
```

---

## Phase 10: The AI Sidebar UI

The final piece: a chat panel that slides in from the right side of the board without disturbing the columns.

```
┌────────────────────────────────────┬───────────────────┐
│          Kanban Board              │    AI Chat        │
│                                    │                   │
│  ┌──────────┐  ┌──────────┐       │  You: Add a card  │
│  │ Backlog  │  │Discovery │       │       called Foo  │
│  │          │  │          │       │                   │
│  │ ┌──────┐ │  │ ┌──────┐ │       │  AI: Done! I've   │
│  │ │Foo   │ │  │ │Card 3│ │       │  added Foo to     │
│  │ └──────┘ │  │ └──────┘ │       │  Backlog.         │
│  │          │  │          │       │                   │
│  │  + Add   │  │  + Add   │       │  ┌─────────────┐  │
│  └──────────┘  └──────────┘       │  │ Type here...│  │
│                                   │  └─────────────┘  │
│                          [AI ▶]   │                   │
└────────────────────────────────────┴───────────────────┘
```

When the AI makes a board change, the Kanban board refreshes automatically — you see the card appear without clicking refresh.

---

## Technology Choices — The Short Version

| What | Technology | Why |
|---|---|---|
| UI framework | Next.js | Industry standard for React apps; produces fast static files |
| Drag and drop | dnd-kit | Reliable, accessible, widely used |
| Styling | Tailwind CSS | Fast to write; no separate stylesheet to maintain |
| Backend language | Python | Readable, widely supported, excellent AI libraries |
| Backend framework | FastAPI | Modern, fast, auto-generates API documentation |
| Database | PostgreSQL | The most trusted open-source database; handles anything you throw at it |
| Container | Docker | One command to start; runs identically everywhere |
| Package manager (Python) | uv | Much faster than pip; handles dependencies cleanly |
| AI gateway | OpenRouter | Access to many AI models; free tier for development |

---

## How to Run the App

Make sure Docker Desktop is installed and running. Then:

```
# Start
scripts/start.sh        (Mac / Linux)
scripts\start.bat       (Windows)

# Stop
scripts/stop.sh         (Mac / Linux)
scripts\stop.bat        (Windows)
```

Open your browser to `http://localhost:8000`. Log in with `user` / `password`.

---

## What Comes Next

The roadmap (in order):

- **Database design sign-off** — the current in-progress phase; schema confirmed, then code follows
- **Backend API** — all board operations wired to the real database
- **Frontend + Backend integration** — board state persists across refreshes
- **AI smoke test** — confirm OpenRouter connection
- **AI with board context** — AI can read and update the board
- **AI sidebar** — full chat UI in the browser

See [PLAN.md](PLAN.md) for the full checklist with success criteria for each phase.

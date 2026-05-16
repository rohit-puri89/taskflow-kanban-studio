# TaskFlow - Kanban Studio

> From ideas to completion. Manage projects intelligently with intuitive boards, AI automation, and seamless collaboration.

A full-stack Kanban board application with AI-powered task management, built with Next.js, FastAPI, PostgreSQL, and OpenRouter.

![TaskFlow Demo](demo-hq.gif)

## Features

- **Intuitive Kanban Board** — 5 customizable columns (Backlog, Discovery, In Progress, Review, Done)
- **Drag-and-Drop** — Move cards between stages with smooth dnd-kit integration
- **AI Assistant** — Natural language task management ("Add a card called X to Backlog", "Move Y to Done")
- **Real-Time Persistence** — Board state synced to Supabase PostgreSQL
- **Authentication** — User login with persistent sessions via sessionStorage
- **Task Management** — Create, edit, delete, and rename cards with full details
- **Column Management** — Rename columns on the fly
- **Professional UI** — Clean, modern design with Tailwind CSS and custom color scheme

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.12+ (for local backend development)
- OpenRouter API key ([get one free](https://openrouter.ai/keys))
- Supabase project ([create one free](https://supabase.com))

### Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd pm
   ```

2. **Create `.env` file**
   ```bash
   cp .env.example .env
   ```

3. **Fill in your credentials in `.env`**
   ```env
   DATABASE_URL=postgresql://postgres.YOUR_PROJECT_ID:YOUR_PASSWORD@aws-1-REGION.pooler.supabase.com:5432/postgres
   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxx
   ```

4. **Start the app**
   ```bash
   docker compose up
   ```

5. **Open in browser**
   ```
   http://localhost:8000
   ```

### Login Credentials (Demo)
- **Username:** `user`
- **Password:** `password`

## Architecture

```
┌─────────────────────────────────────────────┐
│         Frontend (Next.js 16)               │
│  - React components with TypeScript         │
│  - Drag-and-drop via dnd-kit                │
│  - AI sidebar for task management           │
│  - Static export for Docker serving         │
└────────────────┬────────────────────────────┘
                 │ REST API
┌────────────────▼────────────────────────────┐
│       Backend (FastAPI + asyncpg)           │
│  - Authentication & sessions                │
│  - Board/card/column CRUD endpoints         │
│  - AI chat endpoint with context            │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│    Database (Supabase PostgreSQL)           │
│  - Users, Boards, Columns, Cards tables     │
│  - Relational schema with cascade deletes   │
└─────────────────────────────────────────────┘
        │
        └──────────────────┐
                           │
        ┌──────────────────▼──────────────────┐
        │  AI (OpenRouter via openai SDK)     │
        │  - Free model: openai/gpt-oss-120b  │
        │  - Structured JSON responses        │
        │  - Board context in system prompt   │
        └────────────────────────────────────┘
```

## Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router, static export)
- **UI:** React 19 with TypeScript
- **Styling:** Tailwind CSS + CSS variables
- **Drag-and-Drop:** dnd-kit with pointer collision detection
- **HTTP:** Built-in fetch with Bearer token auth
- **Testing:** Vitest + Testing Library (unit), Playwright (e2e)

### Backend
- **Framework:** FastAPI with async lifespan
- **Database:** asyncpg (async PostgreSQL driver)
- **Auth:** In-memory sessions (JWT-ready)
- **AI:** OpenAI SDK pointed at OpenRouter
- **Testing:** pytest with mocked dependencies

### Infrastructure
- **Docker:** Multi-stage build (Node.js → Python)
- **Database:** Supabase (managed PostgreSQL with connection pooling)
- **Deployment:** Ready for Vercel (frontend) + Railway/Heroku (backend)

## Project Structure

```
pm/
├── frontend/                      # Next.js app
│   ├── src/
│   │   ├── app/                  # App Router pages
│   │   │   ├── page.tsx          # Kanban board
│   │   │   └── login/
│   │   │       └── page.tsx      # Login form
│   │   ├── components/
│   │   │   ├── KanbanBoard.tsx   # Main board component
│   │   │   ├── KanbanColumn.tsx  # Column with cards
│   │   │   ├── KanbanCard.tsx    # Individual card
│   │   │   └── AiSidebar.tsx     # AI chat interface
│   │   └── lib/
│   │       ├── auth.ts           # Auth helpers
│   │       ├── api.ts            # API client
│   │       └── kanban.ts         # Board logic
│   └── tests/                     # Playwright e2e tests
│
├── backend/                       # FastAPI app
│   ├── main.py                   # Routes & lifespan
│   ├── db.py                     # Database layer
│   ├── auth.py                   # Authentication
│   ├── ai.py                     # AI integration
│   ├── pyproject.toml            # Dependencies
│   └── tests/                     # pytest unit tests
│
├── docs/
│   ├── PLAN.md                   # 10-part implementation roadmap
│   ├── schema.json               # Database schema
│   └── database.md               # Schema documentation
│
├── Dockerfile                     # Multi-stage build
├── docker-compose.yml            # Service orchestration
├── .env.example                  # Env template
└── README.md                     # This file
```

## Workflow

### Creating & Moving Tasks
1. Click **"Add a card"** in any column
2. Enter task title and details
3. Click **"Add card"** — it appears at the bottom of the column
4. **Drag** the card to move it between columns
5. Tasks persist automatically to the database

### Using AI Assistant
1. Click **"AI Assistant"** button in the header
2. Type a natural language request:
   - _"Add a card called 'Design API' to In Progress"_
   - _"Move 'Design API' to Review"_
   - _"What cards are in Backlog?"_
3. The AI reads the current board state and executes the request
4. Board updates automatically if changes were made

### Renaming Columns
1. Click on any column title (e.g., "Backlog")
2. Edit the text directly
3. Click outside or press Blur — change persists

## Success Criteria (All Completed)

- Part 1: Plan reviewed and approved
- Part 2: Docker setup with FastAPI health check
- Part 3: Static Next.js frontend served by FastAPI
- Part 4: Fake user login with sessionStorage persistence
- Part 5: Database schema designed and approved
- Part 6: Backend API with full CRUD for board management
- Part 7: Frontend + Backend integration with real persistence
- Part 8: AI connectivity via OpenRouter smoke test
- Part 9: AI with board context and structured output
- Part 10: AI sidebar UI with real-time board refresh

## Testing

### Run Tests Locally

**Frontend (unit tests)**
```bash
cd frontend
npm test
```

**Frontend (e2e tests)**
```bash
cd frontend
npx playwright test
```

**Backend (unit tests)**
```bash
cd backend
.venv/bin/pytest -v
```

### Test Coverage
- **Frontend:** 20+ unit tests (auth, API, component rendering)
- **Backend:** 33+ unit tests (auth, board CRUD, AI chat)
- **E2E:** 9+ Playwright tests (login, drag-drop, persistence, AI)

## Security Notes

### Current (Internal Demo)
- Hardcoded credentials (`user`/`password`)
- In-memory sessions (no persistence)
- No HTTPS enforcement
- Environment variables in `.env` (git-ignored)

### For Production
- Implement proper authentication (OAuth, JWT with expiration)
- Use password hashing (bcrypt/argon2)
- Enable HTTPS with TLS certificates
- Add rate limiting and CORS configuration
- Use secrets manager (AWS Secrets, HashiCorp Vault)
- Implement audit logging for all mutations
- Add input validation and SQL injection prevention

## Deployment

### Frontend
Deploy static export to Vercel:
```bash
# In frontend/
npm run build
vercel --prod
```

### Backend
Deploy FastAPI to Railway/Heroku:
```bash
# Set DATABASE_URL and OPENROUTER_API_KEY in platform secrets
git push heroku main
```

### Database
Use Supabase's managed PostgreSQL (no setup needed after initial config).

## API Documentation

### Authentication
```
POST /api/auth/login
  Body: { username: "user", password: "password" }
  Response: { token: "..." }

POST /api/auth/logout
  Headers: Authorization: Bearer <token>
```

### Board Management
```
GET /api/board
  Returns: { columns: [...], cards: {...} }

PUT /api/board/columns/{column_id}
  Body: { title: "New Name" }

POST /api/board/cards
  Body: { column_id: "...", title: "...", details: "..." }
  Response: { id, title, details }

PUT /api/board/cards/{card_id}
  Body: { title: "...", details: "..." }

DELETE /api/board/cards/{card_id}

PUT /api/board/cards/{card_id}/move
  Body: { column_id: "...", position: 0 }
```

### AI Chat
```
POST /api/ai/chat
  Headers: Authorization: Bearer <token>
  Body: {
    message: "Add a card called X to Backlog",
    history: [{ role: "user", content: "..." }, ...]
  }
  Response: {
    message: "Added the card!",
    board_updated: true
  }

POST /api/ai/test
  Response: { response: "4" }  // Simple smoke test
```

## UI Customization

All colors use CSS variables (see `frontend/src/app/globals.css`):
```css
--primary-blue: #209dd7
--secondary-purple: #753991      /* AI button, card edit/save */
--accent-yellow: #ecad0a         /* Column indicators */
--navy-dark: #032147             /* Text, headings */
--gray-text: #888888             /* Secondary text */
--surface: #f7f8fb               /* Light backgrounds */
--surface-strong: #ffffff        /* Card backgrounds */
```


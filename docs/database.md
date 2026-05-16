# Database Design

## Engine

Supabase local (Postgres 15). Runs alongside the app in Docker. Tables are created on startup with `CREATE TABLE IF NOT EXISTS` — no manual migration step needed for the MVP.

## Tables

```
users
  └─< boards
        └─< columns
              └─< cards
```

### users

Stores user accounts. The MVP hardcodes credentials in the app, but `password_hash` is included so real auth can be added without a schema change.

| Column        | Type        | Notes                  |
|---------------|-------------|------------------------|
| id            | UUID        | Primary key            |
| username      | TEXT        | Unique                 |
| password_hash | TEXT        | Bcrypt hash (future)   |
| created_at    | TIMESTAMPTZ | Set on insert          |

### boards

One board per user for the MVP. The foreign key to `users` is in place so multi-board support is just an API change.

| Column     | Type        | Notes                        |
|------------|-------------|------------------------------|
| id         | UUID        | Primary key                  |
| user_id    | UUID        | FK → users.id (CASCADE)      |
| name       | TEXT        | e.g. "My Board"              |
| created_at | TIMESTAMPTZ | Set on insert                |

### columns

Kanban columns (Backlog, Discovery, etc.). `position` is a 0-indexed integer that determines left-to-right display order.

| Column     | Type        | Notes                              |
|------------|-------------|------------------------------------|
| id         | UUID        | Primary key                        |
| board_id   | UUID        | FK → boards.id (CASCADE)           |
| title      | TEXT        | Editable column name               |
| position   | INTEGER     | 0-indexed; unique per board        |
| created_at | TIMESTAMPTZ | Set on insert                      |

### cards

Cards within a column. `position` is a 0-indexed integer within the column.

| Column     | Type        | Notes                              |
|------------|-------------|------------------------------------|
| id         | UUID        | Primary key                        |
| column_id  | UUID        | FK → columns.id (CASCADE)          |
| title      | TEXT        | Card title                         |
| details    | TEXT        | Card body; defaults to empty       |
| position   | INTEGER     | 0-indexed; unique per column       |
| created_at | TIMESTAMPTZ | Set on insert                      |

## Position ordering

Position is a plain integer (0, 1, 2, …). When a card moves or is inserted, the backend renumbers all positions in the affected column(s) to keep them contiguous and correct. This is simple to reason about and correct by construction — no gaps or float precision issues.

Example: moving card at position 2 to position 0 in a 4-card column:
- Card at 0 → 1
- Card at 1 → 2
- Card at 2 → 0  (the moved card)
- Card at 3 → 3  (unchanged)

The same logic applies when a card moves between columns — positions in both the source and destination column are renumbered.

## Cascade deletes

All foreign keys use `ON DELETE CASCADE`:
- Deleting a user removes their boards, columns, and cards.
- Deleting a board removes its columns and cards.
- Deleting a column removes its cards.

## Seed data

On first startup, if no user named `user` exists, the backend inserts:
- One `users` row (`username = "user"`, `password_hash = ""`)
- One `boards` row (`name = "My Board"`)
- Five `columns` rows (Backlog, Discovery, In Progress, Review, Done)
- No cards — the board starts empty

## Future considerations

- `password_hash` is already in the schema; wiring up real bcrypt auth requires no schema change.
- Adding more boards per user is already supported by the schema.
- For high-traffic use, position renumbering could be replaced with fractional indexing to avoid multi-row updates on every move.

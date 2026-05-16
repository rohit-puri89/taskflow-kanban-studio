FROM node:22-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app

COPY backend/pyproject.toml .
RUN uv pip install --system fastapi "uvicorn[standard]" asyncpg openai

COPY backend/main.py backend/db.py backend/auth.py backend/ai.py ./
COPY --from=frontend-builder /frontend/out ./static/

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

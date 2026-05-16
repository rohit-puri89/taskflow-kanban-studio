import { getToken } from "./auth";
import type { BoardData, Card } from "./kanban";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchBoard(): Promise<BoardData> {
  return apiFetch<BoardData>("/api/board");
}

export function renameColumn(columnId: string, title: string): Promise<void> {
  return apiFetch<void>(`/api/board/columns/${columnId}`, {
    method: "PUT",
    body: JSON.stringify({ title }),
  });
}

export function addCard(columnId: string, title: string, details: string): Promise<Card> {
  return apiFetch<Card>("/api/board/cards", {
    method: "POST",
    body: JSON.stringify({ column_id: columnId, title, details }),
  });
}

export function editCard(cardId: string, title: string, details: string): Promise<void> {
  return apiFetch<void>(`/api/board/cards/${cardId}`, {
    method: "PUT",
    body: JSON.stringify({ title, details }),
  });
}

export function deleteCard(cardId: string): Promise<void> {
  return apiFetch<void>(`/api/board/cards/${cardId}`, { method: "DELETE" });
}

export function moveCard(cardId: string, columnId: string, position: number): Promise<void> {
  return apiFetch<void>(`/api/board/cards/${cardId}/move`, {
    method: "PUT",
    body: JSON.stringify({ column_id: columnId, position }),
  });
}

export function login(username: string, password: string): Promise<{ token: string }> {
  return apiFetch<{ token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function register(username: string, password: string): Promise<{ token: string; username: string }> {
  return apiFetch<{ token: string; username: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function chat(
  message: string,
  history: { role: string; content: string }[]
): Promise<{ message: string; board_updated: boolean }> {
  return apiFetch<{ message: string; board_updated: boolean }>("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}
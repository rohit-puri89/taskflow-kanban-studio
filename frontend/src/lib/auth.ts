const TOKEN_KEY = "kanban_token";

export async function login(username: string, password: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return false;
    const { token } = await res.json();
    sessionStorage.setItem(TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

export async function register(username: string, password: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return false;
    const { token } = await res.json();
    sessionStorage.setItem(TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore network errors on logout
    }
  }
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(sessionStorage.getItem(TOKEN_KEY));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}
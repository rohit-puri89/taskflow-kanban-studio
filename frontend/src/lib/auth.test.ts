import { describe, it, expect, beforeEach, vi } from "vitest";
import { login, logout, isAuthenticated, getToken } from "@/lib/auth";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  sessionStorage.clear();
  mockFetch.mockReset();
});

describe("login", () => {
  it("returns true and stores token for correct credentials", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: "abc123" }),
    });
    expect(await login("user", "password")).toBe(true);
    expect(isAuthenticated()).toBe(true);
    expect(getToken()).toBe("abc123");
  });

  it("returns false for non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    expect(await login("wrong", "wrong")).toBe(false);
    expect(isAuthenticated()).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    expect(await login("user", "password")).toBe(false);
    expect(isAuthenticated()).toBe(false);
  });
});

describe("logout", () => {
  it("clears auth state and calls logout API", async () => {
    sessionStorage.setItem("kanban_token", "test-token");
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await logout();
    expect(isAuthenticated()).toBe(false);
    expect(getToken()).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );
  });

  it("clears token even if logout API fails", async () => {
    sessionStorage.setItem("kanban_token", "test-token");
    mockFetch.mockRejectedValue(new Error("Network error"));
    await logout();
    expect(isAuthenticated()).toBe(false);
  });
});

describe("isAuthenticated", () => {
  it("returns false when not logged in", () => {
    expect(isAuthenticated()).toBe(false);
  });

  it("returns true when token is in sessionStorage", () => {
    sessionStorage.setItem("kanban_token", "some-token");
    expect(isAuthenticated()).toBe(true);
  });
});

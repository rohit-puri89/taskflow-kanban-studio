import { describe, it, expect, beforeEach, vi } from "vitest";
import * as api from "@/lib/api";

vi.mock("@/lib/auth", () => ({
  getToken: vi.fn().mockReturnValue("test-token"),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const ok = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: true,
    status,
    json: () => Promise.resolve(body),
  });

const fail = (status: number, detail: string) =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ detail }),
  });

describe("api", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("fetchBoard sends GET /api/board with auth header", async () => {
    const board = { columns: [], cards: {} };
    mockFetch.mockReturnValue(ok(board));
    const result = await api.fetchBoard();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/board",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );
    expect(result).toEqual(board);
  });

  it("renameColumn sends PUT /api/board/columns/{id}", async () => {
    mockFetch.mockReturnValue(ok({ ok: true }));
    await api.renameColumn("col-1", "Sprint 1");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/board/columns/col-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ title: "Sprint 1" }),
      })
    );
  });

  it("addCard sends POST /api/board/cards and returns card", async () => {
    const card = { id: "card-1", title: "Test", details: "" };
    mockFetch.mockReturnValue(ok(card, 201));
    const result = await api.addCard("col-1", "Test", "");
    expect(result).toEqual(card);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/board/cards",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ column_id: "col-1", title: "Test", details: "" }),
      })
    );
  });

  it("editCard sends PUT /api/board/cards/{id}", async () => {
    mockFetch.mockReturnValue(ok({ id: "card-1", title: "Updated", details: "new" }));
    await api.editCard("card-1", "Updated", "new");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/board/cards/card-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ title: "Updated", details: "new" }),
      })
    );
  });

  it("deleteCard sends DELETE /api/board/cards/{id}", async () => {
    mockFetch.mockReturnValue(ok({ ok: true }));
    await api.deleteCard("card-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/board/cards/card-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("moveCard sends PUT /api/board/cards/{id}/move", async () => {
    mockFetch.mockReturnValue(ok({ ok: true }));
    await api.moveCard("card-1", "col-2", 3);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/board/cards/card-1/move",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ column_id: "col-2", position: 3 }),
      })
    );
  });

  it("throws with detail message on non-ok response", async () => {
    mockFetch.mockReturnValue(fail(401, "Unauthorized"));
    await expect(api.fetchBoard()).rejects.toThrow("Unauthorized");
  });

  it("throws with status text when no detail in error body", async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("not json")),
      })
    );
    await expect(api.fetchBoard()).rejects.toThrow("Internal Server Error");
  });
});

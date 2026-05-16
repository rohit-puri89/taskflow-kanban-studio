import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import * as apiModule from "@/lib/api";

// Stable router reference — prevents useEffect([router]) from re-running fetchBoard on every render
const mockRouter = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("@/lib/auth", () => ({
  logout: vi.fn().mockResolvedValue(undefined),
  getToken: vi.fn().mockReturnValue("test-token"),
}));

vi.mock("@/lib/api", () => ({
  fetchBoard: vi.fn().mockResolvedValue({
    columns: [
      { id: "col-1", title: "Backlog", cardIds: ["card-1"] },
      { id: "col-2", title: "Discovery", cardIds: [] },
      { id: "col-3", title: "In Progress", cardIds: [] },
      { id: "col-4", title: "Review", cardIds: [] },
      { id: "col-5", title: "Done", cardIds: [] },
    ],
    cards: {
      "card-1": { id: "card-1", title: "Test card", details: "Some details" },
    },
  }),
  renameColumn: vi.fn().mockResolvedValue(undefined),
  addCard: vi.fn().mockResolvedValue({ id: "card-new", title: "New card", details: "Notes" }),
  editCard: vi.fn().mockResolvedValue(undefined),
  deleteCard: vi.fn().mockResolvedValue(undefined),
  moveCard: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.mocked(apiModule.fetchBoard).mockResolvedValue({
    columns: [
      { id: "col-1", title: "Backlog", cardIds: ["card-1"] },
      { id: "col-2", title: "Discovery", cardIds: [] },
      { id: "col-3", title: "In Progress", cardIds: [] },
      { id: "col-4", title: "Review", cardIds: [] },
      { id: "col-5", title: "Done", cardIds: [] },
    ],
    cards: {
      "card-1": { id: "card-1", title: "Test card", details: "Some details" },
    },
  });
});

const getFirstColumn = async () => {
  const columns = await screen.findAllByTestId(/column-/i);
  return columns[0];
};

describe("KanbanBoard", () => {
  it("renders five columns after loading", async () => {
    render(<KanbanBoard />);
    const columns = await screen.findAllByTestId(/column-/i);
    expect(columns).toHaveLength(5);
  });

  it("renames a column via local input", async () => {
    render(<KanbanBoard />);
    const column = await getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("calls addCard API when form is submitted", async () => {
    render(<KanbanBoard />);
    const column = await getFirstColumn();

    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    await waitFor(() => expect(apiModule.addCard).toHaveBeenCalledWith("col-1", "New card", "Notes"));
  });

  it("removes a card optimistically when delete is clicked", async () => {
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);

    expect(screen.getByText("Test card")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /delete test card/i }));
    await waitFor(() => expect(screen.queryByText("Test card")).not.toBeInTheDocument());
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/login/page";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/lib/auth", () => ({
  login: vi.fn((username: string, password: string) =>
    Promise.resolve(username === "user" && password === "password")
  ),
}));

beforeEach(() => {
  mockReplace.mockClear();
});

describe("LoginPage", () => {
  it("renders username and password fields", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/username/i)).toBeDefined();
    expect(screen.getByLabelText(/password/i)).toBeDefined();
  });

  it("redirects to / on correct credentials", async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "user" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
  });

  it("shows error message on wrong credentials", async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "bad" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "bad" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByText(/invalid username or password/i)).toBeDefined()
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

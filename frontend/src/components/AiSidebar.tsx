"use client";

import { useRef, useEffect, useState, type KeyboardEvent } from "react";
import * as api from "@/lib/api";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type AiSidebarProps = {
  onBoardRefresh: () => void;
};

export const AiSidebar = ({ onBoardRefresh }: AiSidebarProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const resp = await api.chat(text, history);
      setMessages((prev) => [...prev, { role: "assistant", content: resp.message }]);
      if (resp.board_updated) {
        onBoardRefresh();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto space-y-4 p-6">
        {messages.length === 0 && !loading && (
          <div className="flex h-full min-h-[200px] items-center justify-center text-center">
            <p className="text-sm leading-6 text-[var(--gray-text)]">
              Ask me to add, move, update, or describe cards on your board.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                msg.role === "user"
                  ? "max-w-[85%] rounded-2xl bg-[var(--secondary-purple)] px-4 py-3 text-sm text-white"
                  : "max-w-[85%] whitespace-pre-wrap rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-sm text-[var(--navy-dark)] shadow-[var(--shadow)]"
              }
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 shadow-[var(--shadow)]">
              <div className="flex gap-1">
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-[var(--gray-text)]"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-[var(--gray-text)]"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-[var(--gray-text)]"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-[var(--stroke)] p-4">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your board…"
            rows={2}
            disabled={loading}
            data-testid="ai-chat-input"
            className="flex-1 resize-none rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--secondary-purple)] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || !input.trim()}
            data-testid="ai-send-button"
            className="self-end rounded-full bg-[var(--secondary-purple)] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--gray-text)]">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
};

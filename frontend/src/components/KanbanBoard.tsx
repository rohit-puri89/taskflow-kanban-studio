"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { AiSidebar } from "@/components/AiSidebar";
import { moveCard as computeMove, type BoardData, type Card } from "@/lib/kanban";
import { logout } from "@/lib/auth";
import * as api from "@/lib/api";

export const KanbanBoard = () => {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    api
      .fetchBoard()
      .then((data) => {
        setBoard(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.message === "Unauthorized" || err.message?.includes("401")) {
          router.replace("/login");
        } else {
          setFetchError(err.message ?? "Failed to load board");
          setLoading(false);
        }
      });
  }, [router]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const handleBoardRefresh = () => {
    api.fetchBoard().then(setBoard).catch(() => {});
  };

  // pointerWithin checks whether the cursor is physically inside the droppable,
  // which is more reliable than closestCorners for horizontal multi-column layouts
  // where the middle columns lose out on corner-distance comparisons.
  const collisionDetection: CollisionDetection = (args) => {
    const within = pointerWithin(args);
    return within.length > 0 ? within : rectIntersection(args);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board?.cards ?? {}, [board]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    if (!over || active.id === over.id || !board) return;

    const cardId = active.id as string;
    const prevBoard = board;
    const newColumns = computeMove(board.columns, cardId, over.id as string);
    const newCol = newColumns.find((col) => col.cardIds.includes(cardId));
    if (!newCol) return;
    const newPosition = newCol.cardIds.indexOf(cardId);

    setBoard({ ...board, columns: newColumns });
    api.moveCard(cardId, newCol.id, newPosition).catch(() => setBoard(prevBoard));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    if (!board) return;
    const prevBoard = board;
    setBoard({
      ...board,
      columns: board.columns.map((col) =>
        col.id === columnId ? { ...col, title } : col
      ),
    });
    api.renameColumn(columnId, title).catch(() => setBoard(prevBoard));
  };

  const handleAddCard = async (columnId: string, title: string, details: string) => {
    try {
      const card = await api.addCard(columnId, title, details);
      setBoard((prev) =>
        prev
          ? {
              ...prev,
              cards: { ...prev.cards, [card.id]: card },
              columns: prev.columns.map((col) =>
                col.id === columnId
                  ? { ...col, cardIds: [...col.cardIds, card.id] }
                  : col
              ),
            }
          : prev
      );
    } catch {
      // card not added — no state change needed
    }
  };

  const handleEditCard = (cardId: string, title: string, details: string) => {
    if (!board) return;
    const prevBoard = board;
    setBoard({
      ...board,
      cards: { ...board.cards, [cardId]: { ...board.cards[cardId], title, details } },
    });
    api.editCard(cardId, title, details).catch(() => setBoard(prevBoard));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    if (!board) return;
    const prevBoard = board;
    setBoard({
      ...board,
      cards: Object.fromEntries(
        Object.entries(board.cards).filter(([id]) => id !== cardId)
      ),
      columns: board.columns.map((col) =>
        col.id === columnId
          ? { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) }
          : col
      ),
    });
    api.deleteCard(cardId).catch(() => setBoard(prevBoard));
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm font-semibold text-[var(--gray-text)]">Loading board...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm font-semibold text-red-500">{fetchError}</p>
      </div>
    );
  }

  if (!board) return null;

  return (
    <>
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                TaskFlow - Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                From ideas to completion. Manage projects intelligently with intuitive boards, AI automation, and seamless collaboration.
              </p>
            </div>
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                data-testid="ai-sidebar-toggle"
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
              >
                {sidebarOpen ? "Close" : "AI Assistant"}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:border-[var(--navy-dark)] hover:text-[var(--navy-dark)]"
              >
                Sign out
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section className="grid gap-6 lg:grid-cols-5">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds
                  .map((cardId) => board.cards[cardId])
                  .filter((card): card is Card => Boolean(card))}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
                onEditCard={handleEditCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>

    {/* AI Sidebar — fixed overlay, slides in from right, never reflows the board */}
    <div
      data-testid="ai-sidebar"
      className={`fixed inset-y-0 right-0 z-50 flex w-[380px] flex-col border-l border-[var(--stroke)] bg-white shadow-[-8px_0_32px_rgba(3,33,71,0.12)] transition-transform duration-300 ease-in-out ${
        sidebarOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            Powered by AI
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-[var(--navy-dark)]">
            TaskFlow - AI Assistant
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="rounded-full border border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:border-[var(--navy-dark)] hover:text-[var(--navy-dark)]"
          aria-label="Close AI sidebar"
        >
          Close
        </button>
      </div>
      <AiSidebar onBoardRefresh={handleBoardRefresh} />
    </div>
    </>
  );
};

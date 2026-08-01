"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Columns3,
  KanbanSquare,
  ListTodo,
  ListChecks,
  Plus,
  SquareKanban,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/projekty/ui/command";
import { useQuickCapture } from "@/components/projekty/todos/QuickCaptureProvider";
import { useIsTouchDevice } from "@/hooks/projekty/useIsTouchDevice";
import { useIsMac } from "@/hooks/projekty/useIsMac";
import { formatShortcut } from "@/lib/projekty/platform";

type BoardHit = { id: string; name: string; background: string | null };
type CardHit = {
  id: string;
  number: string;
  title: string;
  boardId: string;
  completed: boolean;
};

const NAV_ITEMS = [
  { href: "/projekty/boards", label: "Nástěnky", icon: SquareKanban },
  { href: "/projekty/my-cards", label: "Moje karty", icon: KanbanSquare },
  { href: "/projekty/todo", label: "Můj To Do list", icon: ListChecks },
] as const;

const VIEW_ITEMS = [
  { view: "kanban", label: "Přepnout na Kanban", icon: Columns3 },
  { view: "list", label: "Přepnout na Seznam", icon: ListTodo },
  { view: "calendar", label: "Přepnout na Kalendář", icon: Calendar },
] as const;

/**
 * Command palette modulu Projekty (Ctrl/⌘+K). Na touch zařízeních se
 * neregistruje. shouldFilter=false — mix lokálního filtru a async výsledků.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [boards, setBoards] = useState<BoardHit[] | null>(null);
  const [cardHits, setCardHits] = useState<CardHit[]>([]);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isTouch = useIsTouchDevice();
  const isMac = useIsMac();
  const quickCapture = useQuickCapture();
  // Zrcadlo `open` pro keydown listener (ten se registruje jen jednou)
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const boardIdOnPage = useMemo(() => {
    const m = pathname.match(/^\/projekty\/boards\/([^/]+)$/);
    return m ? m[1] : null;
  }, [pathname]);

  // Ctrl/⌘+K (bez shiftu — ten patří quick-capture)
  useEffect(() => {
    if (isTouch) return;
    function handler(e: KeyboardEvent) {
      if (
        !(e.metaKey || e.ctrlKey) ||
        e.shiftKey ||
        e.altKey ||
        e.key.toLowerCase() !== "k"
      ) {
        return;
      }
      // Otevřená paleta: zavřít bez ohledu na focus (fokus drží její vlastní
      // input, editable guard níže by jinak zkratku propustil prohlížeči).
      if (openRef.current) {
        e.preventDefault();
        setOpen(false);
        setQuery("");
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isTouch]);

  // Lazy fetch boardů při prvním otevření
  useEffect(() => {
    if (!open || boards !== null) return;
    fetch("/api/projekty/boards")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { boards: BoardHit[] }) => setBoards(data.boards))
      .catch(() => setBoards([]));
  }, [open, boards]);

  // Debounced hledání karet (reset i fetch až v timeru — žádný setState
  // synchronně v effectu)
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const timer = setTimeout(
      () => {
        if (q.length < 2) {
          abortRef.current?.abort();
          setCardHits([]);
          setSearching(false);
          return;
        }
        setSearching(true);
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        fetch(`/api/projekty/cards?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        })
          .then((res) => (res.ok ? res.json() : Promise.reject()))
          .then((data: { cards: CardHit[] }) => {
            setCardHits(data.cards);
            setSearching(false);
          })
          .catch((err: unknown) => {
            if (err instanceof DOMException && err.name === "AbortError") return;
            setCardHits([]);
            setSearching(false);
          });
      },
      q.length < 2 ? 0 : 200,
    );
    return () => clearTimeout(timer);
  }, [open, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  function go(href: string) {
    close();
    router.push(href);
  }

  function switchView(view: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (view === "kanban") sp.delete("view");
    else sp.set("view", view);
    if (view !== "calendar") sp.delete("month");
    if (view !== "list") sp.delete("group");
    close();
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`);
  }

  if (isTouch) return null;

  const q = query.trim().toLowerCase();
  const navMatches = NAV_ITEMS.filter((n) => !q || n.label.toLowerCase().includes(q));
  const boardMatches = (boards ?? []).filter(
    (b) => !q || b.name.toLowerCase().includes(q),
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title="Paleta příkazů"
      description="Hledej boardy, karty a akce"
      showCloseButton={false}
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Hledej boardy, karty, akce…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>
          {searching ? "Hledám…" : "Nic nenalezeno."}
        </CommandEmpty>

        {navMatches.length > 0 ? (
          <CommandGroup heading="Navigace">
            {navMatches.map((n) => (
              <CommandItem key={n.href} value={`nav-${n.href}`} onSelect={() => go(n.href)}>
                <n.icon className="text-muted-foreground" />
                {n.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {boardMatches.length > 0 ? (
          <CommandGroup heading="Nástěnky">
            {boardMatches.slice(0, 7).map((b) => (
              <CommandItem
                key={b.id}
                value={`board-${b.id}`}
                onSelect={() => go(`/projekty/boards/${b.id}`)}
              >
                <span
                  className="size-3 shrink-0 rounded"
                  style={{ backgroundColor: b.background ?? "#475569" }}
                  aria-hidden
                />
                {b.name}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {cardHits.length > 0 ? (
          <CommandGroup heading="Karty">
            {cardHits.map((c) => (
              <CommandItem
                key={c.id}
                value={`card-${c.id}`}
                onSelect={() => go(`/projekty/boards/${c.boardId}?card=${c.id}`)}
              >
                {c.completed ? (
                  <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <KanbanSquare className="text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {c.number}
                </span>
                <span className={c.completed ? "line-through opacity-70" : undefined}>
                  {c.title}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        <CommandSeparator />
        <CommandGroup heading="Akce">
          <CommandItem
            value="action-new-todo"
            onSelect={() => {
              close();
              quickCapture.open();
            }}
          >
            <Plus className="text-muted-foreground" />
            Nový osobní úkol
            <CommandShortcut>{formatShortcut("mod+shift+U", isMac)}</CommandShortcut>
          </CommandItem>
          {boardIdOnPage
            ? VIEW_ITEMS.filter(
                (v) => !q || v.label.toLowerCase().includes(q),
              ).map((v) => (
                <CommandItem
                  key={v.view}
                  value={`action-view-${v.view}`}
                  onSelect={() => switchView(v.view)}
                >
                  <v.icon className="text-muted-foreground" />
                  {v.label}
                </CommandItem>
              ))
            : null}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

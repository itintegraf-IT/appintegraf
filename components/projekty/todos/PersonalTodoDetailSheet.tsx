"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calendar as CalendarIcon,
  X,
  ArrowRightCircle,
  Trash2,
  CircleDot,
} from "lucide-react";
import type { PersonalTodo } from "@prisma/client";
import { TodoStatusCheckbox, TODO_STATUS_LABEL } from "@/components/projekty/todos/TodoStatusCheckbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/projekty/ui/dropdown-menu";
import { TiptapEditor } from "@/components/projekty/editor/TiptapEditor";
import { toast } from "sonner";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { cn } from "@/lib/projekty/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/projekty/ui/sheet";
import { Button } from "@/components/projekty/ui/button";
import { Calendar } from "@/components/projekty/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/projekty/ui/alert-dialog";

export function PersonalTodoDetailSheet({
  todo,
  open,
  onOpenChange,
  onMutated,
  onPromoteClick,
}: {
  todo: PersonalTodo | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onMutated: () => void;
  onPromoteClick: (todo: PersonalTodo) => void;
}) {
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Hodnota popisu známá na serveru + rozpracovaná neuložená změna (pro flush při zavření).
  const savedDescRef = useRef<string>("");
  const pendingDescRef = useRef<{ id: string; value: string } | null>(null);

  // Resetuj draft jen při ZMĚNĚ todo (nová id), ne na každý server refresh.
  // Server refresh aktualizuje todo prop reference, ale typing user by jinak
  // ztratil rozepsaný text. Status/dueDate čteme z todo prop přímo (vždy fresh).
  useEffect(() => {
    if (todo) {
      setTitleDraft(todo.title);
      setDescDraft(todo.description ?? "");
      savedDescRef.current = todo.description ?? "";
      pendingDescRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todo?.id]);

  // Debounced auto-save pro description (Tiptap fires onChange na keystroke).
  // Silent mode = NEvoláme onMutated/router.refresh() → Tiptap suggestion lifecycle
  // (slash menu, block handles atd.) zůstane stabilní. Description draft už máme
  // v local state, server data nejsou potřeba pro UI.
  useEffect(() => {
    if (!todo) return;
    if (descDraft === savedDescRef.current) {
      pendingDescRef.current = null;
      return;
    }
    pendingDescRef.current = { id: todo.id, value: descDraft };
    const t = setTimeout(() => {
      const value = descDraft;
      void patch({ description: value || null }, { silent: true });
      savedDescRef.current = value;
      if (pendingDescRef.current?.value === value) pendingDescRef.current = null;
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descDraft]);

  // Flush neuloženého popisu při zavření/unmountu detailu — jinak by se posledních
  // <800 ms úprav ztratilo (debounce timeout se při unmountu zruší). keepalive dokončí
  // request i během navigace.
  useEffect(() => {
    return () => {
      const pending = pendingDescRef.current;
      if (pending) {
        void fetch(`/api/projekty/personal-todos/${pending.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: pending.value || null }),
          keepalive: true,
        });
      }
    };
  }, []);

  if (!todo) return null;

  const dueDate = todo.dueDate ? new Date(todo.dueDate) : null;

  async function patch(data: Record<string, unknown>, opts?: { silent?: boolean }) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/personal-todos/${todo!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("API error");
      if (!opts?.silent) onMutated();
    } catch {
      toast.error("Změna se nezdařila");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/personal-todos/${todo!.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("API error");
      toast.success("Úkol smazán");
      setConfirmDelete(false);
      onOpenChange(false);
      onMutated();
    } catch {
      toast.error("Smazání se nezdařilo");
    } finally {
      setBusy(false);
    }
  }

  function saveTitle() {
    const next = titleDraft.trim();
    if (!next) {
      setTitleDraft(todo!.title);
      return;
    }
    if (next !== todo!.title) void patch({ title: next });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
        >
          {/* Header */}
          <SheetHeader className="flex-row items-center justify-between gap-2 border-b border-[hsl(var(--notion-fg)/0.08)] px-5 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--notion-fg)/0.5)]">
                Detail úkolu
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Zavřít"
              className="grid size-7 place-items-center rounded-md text-[hsl(var(--notion-fg)/0.5)] hover:bg-[hsl(var(--notion-fg)/0.06)] hover:text-[hsl(var(--notion-fg))]"
            >
              <X className="size-4" />
            </button>
            <SheetTitle className="sr-only">{todo.title}</SheetTitle>
            <SheetDescription className="sr-only">Detail osobního úkolu</SheetDescription>
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {/* Status row + title */}
            <div className="flex items-start gap-3">
              <div className="mt-1.5">
                <TodoStatusCheckbox
                  status={todo.status}
                  onChange={(next) => void patch({ status: next })}
                  disabled={busy}
                  size="lg"
                  stopPropagation={false}
                />
              </div>
              <textarea
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                  if (e.key === "Escape") {
                    setTitleDraft(todo.title);
                    e.currentTarget.blur();
                  }
                }}
                rows={1}
                placeholder="Bez názvu"
                className={cn(
                  "flex-1 resize-none border-0 bg-transparent text-2xl font-bold tracking-tight focus:outline-none",
                  todo.status === "DONE" && "text-[hsl(var(--notion-fg)/0.45)] line-through",
                )}
                style={{ minHeight: "2.5rem" }}
              />
            </div>

            {/* Properties */}
            <div className="mt-5 space-y-3">
              <PropertyRow icon={<CalendarIcon className="size-3.5" />} label="Termín">
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      <CalendarIcon className="mr-2 size-3.5" />
                      {dueDate ? format(dueDate, "d. M. yyyy", { locale: cs }) : "Vybrat termín"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate ?? undefined}
                      onSelect={(date) => {
                        void patch({ dueDate: date ? date.toISOString() : null });
                        setDateOpen(false);
                      }}
                      locale={cs}
                    />
                  </PopoverContent>
                </Popover>
                {dueDate ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => void patch({ dueDate: null })}
                    aria-label="Smazat termín"
                  >
                    <X className="size-3.5" />
                  </Button>
                ) : null}
              </PropertyRow>

              <PropertyRow icon={<CircleDot className="size-3.5" />} label="Stav">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={busy}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:opacity-80",
                        todo.status === "DONE" && "bg-emerald-100 text-emerald-700",
                        todo.status === "IN_PROGRESS" && "bg-amber-100 text-amber-700",
                        todo.status === "NOT_STARTED" &&
                          "bg-[hsl(var(--notion-fg)/0.06)] text-[hsl(var(--notion-fg)/0.7)]",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          todo.status === "DONE" && "bg-emerald-500",
                          todo.status === "IN_PROGRESS" && "bg-amber-500",
                          todo.status === "NOT_STARTED" &&
                            "bg-[hsl(var(--notion-fg)/0.4)]",
                        )}
                      />
                      {TODO_STATUS_LABEL[todo.status]}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => void patch({ status: "NOT_STARTED" })}>
                      <span className="mr-2 size-1.5 rounded-full bg-[hsl(var(--notion-fg)/0.4)]" />
                      K vyřízení
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void patch({ status: "IN_PROGRESS" })}>
                      <span className="mr-2 size-1.5 rounded-full bg-amber-500" />
                      Rozpracováno
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void patch({ status: "DONE" })}>
                      <span className="mr-2 size-1.5 rounded-full bg-emerald-500" />
                      Hotovo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </PropertyRow>
            </div>

            {/* Description — rich Tiptap (slash menu, headings, callouts, toggles…) */}
            <div className="mt-6 space-y-1.5">
              <label className="block text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--notion-fg)/0.5)]">
                Popis
              </label>
              <TiptapEditor
                key={todo.id}
                value={descDraft}
                onChange={setDescDraft}
                placeholder="Stiskni / pro bloky, jinak piš…"
                variant="rich"
              />
              <p className="pt-1 text-[11px] text-[hsl(var(--notion-fg)/0.45)]">
                Změny se uloží automaticky.
              </p>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-2 border-t border-[hsl(var(--notion-fg)/0.08)] px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPromoteClick(todo)}
              disabled={busy || todo.status === "DONE"}
            >
              <ArrowRightCircle className="mr-2 size-3.5" />
              Přesunout do projektu
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-2 size-3.5" />
              Smazat
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat úkol?</AlertDialogTitle>
            <AlertDialogDescription>
              Úkol „{todo.title}" bude trvale smazán. Tuto akci nelze vrátit zpět.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {busy ? "Mažu…" : "Smazat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PropertyRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-24 shrink-0 items-center gap-1.5 text-xs font-medium text-[hsl(var(--notion-fg)/0.55)]">
        {icon}
        {label}
      </div>
      <div className="flex flex-1 items-center gap-1.5">{children}</div>
    </div>
  );
}

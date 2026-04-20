"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { X, ChevronRight, ExternalLink, LayoutDashboard, Search } from "lucide-react";
import { HELP_REGISTRY, type HelpEntry } from "@/lib/help/help-registry";
import {
  getAccessibleHelpEntries,
  resolveHelpKey,
} from "@/lib/help/resolve-help";

type Props = {
  open: boolean;
  onClose: () => void;
  moduleAccess: Record<string, boolean>;
  isAdmin: boolean;
};

export function HelpDrawer({ open, onClose, moduleAccess, isAdmin }: Props) {
  const pathname = usePathname();
  const autoKey = useMemo(() => resolveHelpKey(pathname ?? "/"), [pathname]);
  const [activeKey, setActiveKey] = useState<string>(autoKey);
  const [showIndex, setShowIndex] = useState(false);
  const [search, setSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setActiveKey(autoKey);
      setShowIndex(false);
      setSearch("");
    }
  }, [open, autoKey]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    closeBtnRef.current?.focus();
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const accessibleEntries = useMemo(
    () => getAccessibleHelpEntries(moduleAccess, isAdmin),
    [moduleAccess, isAdmin]
  );

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accessibleEntries;
    return accessibleEntries.filter((e) =>
      [e.title, e.intro, ...(e.features ?? []), ...(e.quickSteps ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [accessibleEntries, search]);

  const entry: HelpEntry =
    HELP_REGISTRY[activeKey] ?? HELP_REGISTRY.fallback;
  const Icon = entry.icon;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  const drawer = (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-drawer-title"
        className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-[440px] flex-col border-l shadow-2xl"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
          color: "var(--foreground)",
        }}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: "var(--accent)",
                color: "var(--primary)",
              }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p
                id="help-drawer-title"
                className="truncate text-sm font-semibold"
              >
                {showIndex ? "Nápověda – přehled modulů" : entry.title}
              </p>
              {!showIndex && entry.path && (
                <p
                  className="truncate text-xs"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {entry.path}
                </p>
              )}
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-[var(--accent)]"
            aria-label="Zavřít nápovědu"
            title="Zavřít (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {showIndex ? (
          <IndexView
            entries={filteredEntries}
            search={search}
            onSearchChange={setSearch}
            onPick={(key) => {
              setActiveKey(key);
              setShowIndex(false);
            }}
          />
        ) : (
          <DetailView entry={entry} />
        )}

        <div
          className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            type="button"
            onClick={() => setShowIndex((v) => !v)}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-[var(--accent)]"
            style={{ borderColor: "var(--border)" }}
          >
            {showIndex ? (
              <>
                <ChevronRight className="h-4 w-4 rotate-180" />
                Zpět na detail
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Procházet všechny moduly
              </>
            )}
          </button>
          {!showIndex && activeKey !== "dashboard" && (
            <button
              type="button"
              onClick={() => setActiveKey("dashboard")}
              className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-[var(--accent)]"
              style={{ borderColor: "var(--border)" }}
            >
              <LayoutDashboard className="h-4 w-4" />
              Nápověda k aplikaci
            </button>
          )}
        </div>
      </aside>
    </>
  );

  return createPortal(drawer, document.body);
}

function DetailView({ entry }: { entry: HelpEntry }) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 text-sm leading-relaxed">
      <p style={{ color: "var(--muted-foreground)" }}>{entry.intro}</p>

      {entry.features.length > 0 && (
        <Section title="Co modul umí">
          <ul className="list-disc space-y-1 pl-5">
            {entry.features.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </Section>
      )}

      {entry.quickSteps.length > 0 && (
        <Section title="Rychlý návod">
          <ol className="list-decimal space-y-1 pl-5">
            {entry.quickSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </Section>
      )}

      {entry.tips && entry.tips.length > 0 && (
        <Section title="Tipy">
          <ul className="list-disc space-y-1 pl-5">
            {entry.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </Section>
      )}

      {entry.shortcuts && entry.shortcuts.length > 0 && (
        <Section title="Klávesové zkratky">
          <ul className="space-y-1">
            {entry.shortcuts.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <span>{s.action}</span>
                <kbd
                  className="rounded border px-1.5 py-0.5 text-xs"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--surface-2)",
                  }}
                >
                  {s.keys}
                </kbd>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {entry.docs && entry.docs.length > 0 && (
        <Section title="Detailní dokumentace">
          <ul className="space-y-1">
            {entry.docs.map((d, i) => (
              <li key={i}>
                <a
                  href={d.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                  style={{ color: "var(--primary)" }}
                >
                  {d.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <h3
        className="mb-2 text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--muted-foreground)" }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function IndexView({
  entries,
  search,
  onSearchChange,
  onPick,
}: {
  entries: HelpEntry[];
  search: string;
  onSearchChange: (v: string) => void;
  onPick: (key: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div
        className="mb-3 flex items-center rounded-lg border px-3 py-2"
        style={{
          background: "var(--surface-2)",
          borderColor: "var(--border)",
        }}
      >
        <Search
          className="mr-2 h-4 w-4"
          style={{ color: "var(--muted-foreground)" }}
        />
        <input
          autoFocus
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Hledat v nápovědě…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>
      {entries.length === 0 ? (
        <p
          className="px-1 py-6 text-center text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          Nic nenalezeno.
        </p>
      ) : (
        <ul className="space-y-1">
          {entries.map((e) => {
            const Icon = e.icon;
            return (
              <li key={e.key}>
                <button
                  type="button"
                  onClick={() => onPick(e.key)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-[var(--accent)]"
                >
                  <Icon
                    className="h-4 w-4 shrink-0"
                    style={{ color: "var(--muted-foreground)" }}
                  />
                  <span className="flex-1">
                    <span className="block font-medium">{e.title}</span>
                    <span
                      className="block truncate text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {e.intro}
                    </span>
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0"
                    style={{ color: "var(--muted-foreground)" }}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

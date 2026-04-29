"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

export type ContactSuggestion = {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
};

export type PhoneListSuggestRow = {
  key: string;
  line1: string;
  line2?: string;
  apply: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSuggestionApplied: (value: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  showIcon?: boolean;
  suggestEnabled?: boolean;
  inputId?: string;
  /** Výchozí: kontakty; `phone-list` = napříč kontakty, odděleními, společnými maily. */
  suggestMode?: "contacts" | "phone-list";
  /** Pro `phone-list` (výchozí `/api/phone-list/suggest`); u veřejné stránky např. `/api/public/phone-list/suggest` */
  phoneListSuggestUrl?: string;
};

const DEBOUNCE_MS = 220;
const MIN_CHARS = 2;

function searchToken(s: ContactSuggestion): string {
  const e = s.email?.trim();
  if (e) return e;
  const last = s.last_name?.trim();
  if (last) return last;
  return s.first_name?.trim() ?? "";
}

type Row =
  | { kind: "contact"; data: ContactSuggestion }
  | { kind: "unified"; data: PhoneListSuggestRow };

export function ContactSearchAutocomplete({
  value,
  onChange,
  onSuggestionApplied,
  className = "",
  inputClassName = "",
  placeholder = "Jméno, e-mail…",
  showIcon = false,
  suggestEnabled = true,
  inputId,
  suggestMode = "contacts",
  phoneListSuggestUrl = "/api/phone-list/suggest",
}: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runFetch = useCallback(
    (q: string) => {
      if (!suggestEnabled || q.trim().length < MIN_CHARS) {
        setRows([]);
        setOpen(false);
        return;
      }
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);

      const url =
        suggestMode === "phone-list"
          ? `${phoneListSuggestUrl}?q=${encodeURIComponent(q.trim())}`
          : `/api/contacts/suggest?q=${encodeURIComponent(q.trim())}`;

      fetch(url, { signal: ac.signal })
        .then((r) => r.json())
        .then(
          (data: {
            suggestions?: ContactSuggestion[] | PhoneListSuggestRow[];
          }) => {
            const list = data.suggestions ?? [];
            if (suggestMode === "phone-list") {
              const unified = (list as PhoneListSuggestRow[]).map(
                (x) => ({ kind: "unified" as const, data: x })
              );
              setRows(unified);
              setOpen(unified.length > 0);
            } else {
              const c = (list as ContactSuggestion[]).map(
                (x) => ({ kind: "contact" as const, data: x })
              );
              setRows(c);
              setOpen(c.length > 0);
            }
            setActiveIndex(-1);
          }
        )
        .catch((err) => {
          if (err?.name === "AbortError") return;
          setRows([]);
          setOpen(false);
        })
        .finally(() => {
          if (!ac.signal.aborted) setLoading(false);
        });
    },
    [suggestEnabled, suggestMode, phoneListSuggestUrl]
  );

  useEffect(() => {
    if (!suggestEnabled) {
      setRows([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runFetch(value);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, suggestEnabled, runFetch]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const applyRow = (row: Row) => {
    if (row.kind === "unified") {
      const t = row.data.apply.trim();
      if (t) {
        onChange(t);
        onSuggestionApplied(t);
      }
    } else {
      const token = searchToken(row.data);
      if (token) {
        onChange(token);
        onSuggestionApplied(token);
      }
    }
    setOpen(false);
    setRows([]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || rows.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i < rows.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : rows.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < rows.length) {
      e.preventDefault();
      applyRow(rows[activeIndex]!);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {showIcon && (
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      )}
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (suggestEnabled && rows.length > 0) setOpen(true);
        }}
        autoComplete="off"
        name="contact-search"
        placeholder={placeholder}
        className={inputClassName}
        aria-autocomplete="list"
        aria-expanded={open}
        role="combobox"
      />
      {suggestEnabled && open && (rows.length > 0 || loading) && (
        <ul
          className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {loading && rows.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">Načítání…</li>
          ) : (
            rows.map((row, idx) => {
              if (row.kind === "unified") {
                const s = row.data;
                return (
                  <li key={s.key} role="option" aria-selected={idx === activeIndex}>
                    <button
                      type="button"
                      className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-red-50 ${
                        idx === activeIndex ? "bg-red-50" : ""
                      }`}
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => applyRow(row)}
                    >
                      <span className="font-medium text-gray-900">{s.line1}</span>
                      {s.line2 && <span className="text-xs text-gray-500">{s.line2}</span>}
                    </button>
                  </li>
                );
              }
              const s = row.data;
              return (
                <li key={s.id} role="option" aria-selected={idx === activeIndex}>
                  <button
                    type="button"
                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-red-50 ${
                      idx === activeIndex ? "bg-red-50" : ""
                    }`}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => applyRow(row)}
                  >
                    <span className="font-medium text-gray-900">
                      {s.first_name} {s.last_name}
                    </span>
                    {s.email && <span className="text-xs text-gray-500">{s.email}</span>}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

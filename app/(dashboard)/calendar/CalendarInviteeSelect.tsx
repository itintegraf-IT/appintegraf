"use client";

import { useCallback, useMemo, useState } from "react";
import { UserPlus, X, Building2 } from "lucide-react";

type Invitee = { id: number; first_name: string; last_name: string };

type DepartmentOption = { id: number; name: string };

type Props = {
  invitees: Invitee[];
  value: number[];
  onChange: (ids: number[]) => void;
  /** Vynechat (zástup apod.) */
  excludeIds?: number[];
  disabled?: boolean;
  /** Pro „Přidat celé oddělení“ (volitelné) */
  departments?: DepartmentOption[];
};

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * Přidávání účastníků: čipy, oddělení jedním tlačítkem, osoby přes vyhledávání.
 */
export function CalendarInviteeSelect({
  invitees,
  value,
  onChange,
  excludeIds = [],
  disabled,
  departments = [],
}: Props) {
  const ex = useMemo(
    () => new Set(excludeIds.filter((x) => x != null && x > 0) as number[]),
    [excludeIds]
  );

  const byId = useMemo(() => {
    const m = new Map<number, Invitee>();
    for (const u of invitees) m.set(u.id, u);
    return m;
  }, [invitees]);

  const [query, setQuery] = useState("");
  const [openSuggest, setOpenSuggest] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [deptLoading, setDeptLoading] = useState(false);

  const addIds = useCallback(
    (newOnes: number[]) => {
      if (disabled) return;
      const s = new Set(value);
      for (const id of newOnes) {
        if (id > 0 && !ex.has(id)) s.add(id);
      }
      onChange([...s].sort((a, b) => a - b));
    },
    [disabled, ex, onChange, value]
  );

  const removeId = (id: number) => {
    if (disabled) return;
    onChange(value.filter((x) => x !== id));
  };

  const suggestions = useMemo(() => {
    const q = query.trim();
    const qn = norm(q);
    const base = invitees.filter((u) => !ex.has(u.id) && !value.includes(u.id));
    if (q.length < 1) {
      return base.slice(0, 8);
    }
    return base
      .filter((u) => norm(`${u.first_name} ${u.last_name}`).includes(qn))
      .slice(0, 30);
  }, [invitees, ex, query, value]);

  const addDepartment = async () => {
    if (!deptName || disabled) return;
    setDeptLoading(true);
    try {
      const res = await fetch(`/api/departments/${encodeURIComponent(deptName)}/members`);
      const data = await res.json().catch(() => ({}));
      const members = Array.isArray(data.members) ? data.members : [];
      const canInvite = new Set(invitees.map((u) => u.id));
      const ids = members
        .map((m: { id: number }) => m.id)
        .filter(
          (id: number) => typeof id === "number" && canInvite.has(id) && !ex.has(id) && !value.includes(id)
        );
      if (ids.length) addIds(ids);
    } catch {
      /* ignore */
    } finally {
      setDeptLoading(false);
    }
  };

  if (invitees.length === 0) {
    return <p className="text-sm text-gray-500">Seznam kolegů se nepodařilo načíst.</p>;
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Vybraní účastníci">
          {value.map((id) => {
            const u = byId.get(id);
            const label = u ? `${u.first_name} ${u.last_name}` : `Uživatel #${id}`;
            return (
              <li
                key={id}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-sm text-red-900"
              >
                <span className="truncate">{label}</span>
                <button
                  type="button"
                  onClick={() => removeId(id)}
                  disabled={disabled}
                  className="shrink-0 rounded p-0.5 text-red-700 hover:bg-red-100"
                  title="Odebrat"
                  aria-label={`Odebrat ${label}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {departments.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-0.5 block text-xs font-medium text-gray-600">Přidat celé oddělení</label>
            <div className="flex gap-2">
              <select
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                disabled={disabled || deptLoading}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">— vyberte oddělení —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void addDepartment()}
                disabled={disabled || !deptName || deptLoading}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                title="Přidat všechny členy oddělení"
              >
                <Building2 className="h-4 w-4" />
                {deptLoading ? "…" : "Přidat"}
              </button>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">Přidají se všichni aktivní z oddělení (včetně v sekundárním).</p>
          </div>
        </div>
      )}

      <div className="relative">
        <label className="mb-0.5 block text-xs font-medium text-gray-600">Přidat osoby</label>
        <div className="relative">
          <div className="flex gap-1">
            <div className="relative min-w-0 flex-1">
              <UserPlus className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                autoComplete="off"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpenSuggest(true);
                }}
                onFocus={() => setOpenSuggest(true)}
                onBlur={() => {
                  setTimeout(() => setOpenSuggest(false), 200);
                }}
                disabled={disabled}
                placeholder="Vyhledejte jméno nebo příjmení…"
                className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-2 text-sm"
              />
            </div>
          </div>
          {openSuggest && suggestions.length > 0 && (
            <ul
              className="absolute z-20 mt-0.5 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-0.5 shadow-md"
              role="listbox"
            >
              {suggestions.map((u) => (
                <li key={u.id} role="option">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      addIds([u.id]);
                      setQuery("");
                    }}
                    disabled={disabled}
                    className="w-full px-2 py-1.5 text-left text-sm text-gray-800 hover:bg-red-50"
                  >
                    {u.first_name} {u.last_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {openSuggest && query.trim().length >= 1 && suggestions.length === 0 && (
            <p className="absolute z-20 mt-0.5 w-full rounded border border-dashed border-gray-200 bg-white px-2 py-2 text-sm text-gray-500">
              Nikdo nenalezen.
            </p>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-500">Prázdné pole zobrazí pár jmen nahoře; psaním zúžíte výběr.</p>
      </div>
    </div>
  );
}

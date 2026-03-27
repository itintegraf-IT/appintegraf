"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractResolverSettingsAdmin } from "@/lib/contracts/contract-resolver-settings";

type UserOpt = { id: number; first_name: string; last_name: string; is_active?: boolean | null };

type RowKey = "legal" | "financial" | "executive";

const LABELS: Record<RowKey, { title: string; hint: string }> = {
  legal: {
    title: "Právní zástupce",
    hint: "Resolver legal_counsel (klíč contracts_resolver_legal_user_id).",
  },
  financial: {
    title: "Ekonomické schválení",
    hint: "Resolver financial_approval (contracts_resolver_financial_user_id).",
  },
  executive: {
    title: "Nejvyšší vedení",
    hint: "Resolver executive (contracts_resolver_executive_user_id).",
  },
};

function rowStateFromSettings(s: ContractResolverSettingsAdmin, key: RowKey): string {
  const v =
    key === "legal"
      ? s.legalUserId
      : key === "financial"
        ? s.financialUserId
        : s.executiveUserId;
  return v == null ? "" : String(v);
}

export function ContractResolverSettingsPanel({
  initial,
}: {
  initial: ContractResolverSettingsAdmin;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<ContractResolverSettingsAdmin>(initial);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [legal, setLegal] = useState(() => rowStateFromSettings(initial, "legal"));
  const [financial, setFinancial] = useState(() => rowStateFromSettings(initial, "financial"));
  const [executive, setExecutive] = useState(() => rowStateFromSettings(initial, "executive"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(initial);
    setLegal(rowStateFromSettings(initial, "legal"));
    setFinancial(rowStateFromSettings(initial, "financial"));
    setExecutive(rowStateFromSettings(initial, "executive"));
  }, [initial]);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data.users) ? data.users : [];
        setUsers(
          list
            .filter((u: UserOpt) => u.is_active !== false)
            .map((u: UserOpt) => ({
              id: u.id,
              first_name: u.first_name,
              last_name: u.last_name,
              is_active: u.is_active,
            }))
        );
      })
      .catch(() => {});
  }, []);

  const setters: Record<RowKey, (v: string) => void> = {
    legal: setLegal,
    financial: setFinancial,
    executive: setExecutive,
  };

  function onManualChange(key: RowKey, raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 9);
    setters[key](digits);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/contract-resolver-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legal_user_id: legal.trim() === "" ? "" : legal,
          financial_user_id: financial.trim() === "" ? "" : financial,
          executive_user_id: executive.trim() === "" ? "" : executive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Uložení se nezdařilo.");
        return;
      }
      if (data.legalUserId !== undefined) {
        const next: ContractResolverSettingsAdmin = {
          legalUserId: data.legalUserId,
          financialUserId: data.financialUserId,
          executiveUserId: data.executiveUserId,
          preview: data.preview,
          warnings: data.warnings,
        };
        setSettings(next);
        setLegal(rowStateFromSettings(next, "legal"));
        setFinancial(rowStateFromSettings(next, "financial"));
        setExecutive(rowStateFromSettings(next, "executive"));
      }
      setSaved(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function Preview({ row }: { row: RowKey }) {
    const p =
      row === "legal"
        ? settings.preview.legal
        : row === "financial"
          ? settings.preview.financial
          : settings.preview.executive;
    const w =
      row === "legal"
        ? settings.warnings.legal
        : row === "financial"
          ? settings.warnings.financial
          : settings.warnings.executive;

    if (w) {
      return <p className="mt-1 text-sm text-amber-700">{w}</p>;
    }
    if (p) {
      return (
        <p className="mt-1 text-sm text-gray-600">
          {p.last_name} {p.first_name} <span className="text-gray-400">(ID {p.id})</span>
        </p>
      );
    }
    return null;
  }

  function Row({ rowKey }: { rowKey: RowKey }) {
    const value =
      rowKey === "legal" ? legal : rowKey === "financial" ? financial : executive;
    const label = LABELS[rowKey];

    return (
      <div className="border-b border-gray-100 py-4 last:border-0">
        <p className="font-medium text-gray-900">{label.title}</p>
        <p className="mt-0.5 text-xs text-gray-500">{label.hint}</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            className="w-full min-w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm sm:max-w-xs"
            value={value === "" ? "" : value}
            onChange={(e) => {
              const v = e.target.value;
              setters[rowKey](v);
            }}
          >
            <option value="">— vyberte uživatele —</option>
            {value !== "" && !users.some((u) => String(u.id) === value) && (
              <option value={value}>ID {value} (není v načteném seznamu)</option>
            )}
            {users.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.last_name} {u.first_name} ({u.id})
              </option>
            ))}
          </select>
          <span className="hidden text-gray-400 sm:inline">nebo</span>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`${rowKey}-id`}>
              ID uživatele ručně
            </label>
            <input
              id={`${rowKey}-id`}
              type="text"
              inputMode="numeric"
              placeholder="ID uživatele ručně"
              className="w-full min-w-[140px] rounded-lg border border-gray-300 px-3 py-2 text-sm sm:max-w-[200px]"
              value={value}
              onChange={(e) => onManualChange(rowKey, e.target.value)}
            />
          </div>
        </div>
        <Preview row={rowKey} />
      </div>
    );
  }

  return (
    <section
      id="resolvers"
      className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-gray-900">Schvalovatelé z centrálního nastavení</h2>
      <p className="mt-1 text-sm text-gray-600">
        Hodnoty se ukládají do nastavení systému v databázi. U kroků šablony s resolverem právní,
        ekonomika nebo vedení se použije zde zadaný uživatel. Můžete vybrat ze seznamu nebo zadat
        číselné ID ručně.
      </p>

      <form onSubmit={handleSubmit} className="mt-4">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {saved && !error && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Nastavení bylo uloženo.
          </div>
        )}

        <Row rowKey="legal" />
        <Row rowKey="financial" />
        <Row rowKey="executive" />

        <div className="mt-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Ukládám…" : "Uložit nastavení schvalovatelů"}
          </button>
        </div>
      </form>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

/** Musí odpovídat `lib/contracts/workflow-template-validation.ts` (bez importu serverového modulu do klienta). */
const CANONICAL_RESOLVERS = [
  "department_manager",
  "legal_counsel",
  "financial_approval",
  "executive",
  "fixed_user",
] as const;

const RESOLVER_LABELS: Record<string, string> = {
  department_manager: "Vedoucí oddělení (dle smlouvy / autora)",
  legal_counsel: "Právní zástupce (system_settings)",
  financial_approval: "Ekonomické schválení (system_settings)",
  executive: "Nejvyšší vedení (system_settings)",
  fixed_user: "Pevný uživatel",
};

type UserOpt = { id: number; first_name: string; last_name: string; is_active?: boolean | null };

export type ContractTypeFormInitial = {
  id: number;
  name: string;
  code: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  steps: { step_order: number; resolver: string; fixed_user_id: number | null }[];
};

type StepRow = {
  clientId: string;
  step_order: number;
  resolver: string;
  fixed_user_id: number | null;
};

function toRows(
  steps: { step_order: number; resolver: string; fixed_user_id: number | null }[]
): StepRow[] {
  return steps.map((s) => ({
    clientId: crypto.randomUUID(),
    step_order: s.step_order,
    resolver: s.resolver,
    fixed_user_id: s.fixed_user_id,
  }));
}

export function ContractTypeForm({ initial }: { initial?: ContractTypeFormInitial }) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserOpt[]>([]);

  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sort_order, setSortOrder] = useState(initial?.sort_order ?? 0);
  const [is_active, setIsActive] = useState(initial?.is_active !== false);
  const [steps, setSteps] = useState<StepRow[]>(() =>
    initial?.steps?.length
      ? toRows(initial.steps)
      : [
          {
            clientId: crypto.randomUUID(),
            step_order: 1,
            resolver: "department_manager",
            fixed_user_id: null,
          },
        ]
  );

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

  const resolverOptions = useMemo(
    () =>
      CANONICAL_RESOLVERS.map((r) => ({
        value: r,
        label: RESOLVER_LABELS[r] ?? r,
      })),
    []
  );

  function addStep() {
    const nextOrder = steps.length === 0 ? 1 : Math.max(...steps.map((s) => s.step_order)) + 1;
    setSteps((prev) => [
      ...prev,
      {
        clientId: crypto.randomUUID(),
        step_order: nextOrder,
        resolver: "department_manager",
        fixed_user_id: null,
      },
    ]);
  }

  function removeStep(clientId: string) {
    setSteps((prev) => prev.filter((s) => s.clientId !== clientId));
  }

  function updateStep(clientId: string, patch: Partial<Omit<StepRow, "clientId">>) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.clientId !== clientId) return s;
        const next = { ...s, ...patch };
        if (patch.resolver != null && patch.resolver !== "fixed_user") {
          next.fixed_user_id = null;
        }
        return next;
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        name,
        code: code.trim() || null,
        description: description.trim() || null,
        sort_order,
        is_active,
        steps: steps.map((s) => ({
          step_order: s.step_order,
          resolver: s.resolver,
          fixed_user_id: s.resolver === "fixed_user" ? s.fixed_user_id : null,
        })),
      };

      const url = isEdit
        ? `/api/admin/contract-types/${initial!.id}`
        : "/api/admin/contract-types";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Uložení se nezdařilo.");
        return;
      }
      router.push("/admin/contract-types");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || !initial?.id) return;
    if (
      !window.confirm(
        "Opravdu smazat tento typ smlouvy? (Jen pokud k němu neexistují smlouvy.)"
      )
    ) {
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/contract-types/${initial.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Smazání se nezdařilo.");
        return;
      }
      router.push("/admin/contract-types");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Základní údaje</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Název *</label>
            <input
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Kód (volitelně)</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={50}
              placeholder="např. DOD"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Řazení (číslo)</label>
            <input
              type="number"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={sort_order}
              onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Popis</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="is_active"
              type="checkbox"
              checked={is_active}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Typ je aktivní (zobrazí se ve formulářích nových smluv)
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Šablona schvalování</h2>
            <p className="mt-1 text-sm text-gray-600">
              Pořadí kroků při odeslání návrhu ke schválení. U resolverů právní, finance a vedení se
              použije uživatel z{" "}
              <Link href="/admin/contract-types#resolvers" className="text-red-600 underline">
                centrálního nastavení schvalovatelů
              </Link>{" "}
              (výběr nebo ruční ID).
            </p>
          </div>
          <button
            type="button"
            onClick={addStep}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Přidat krok
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-sm">
                <th className="px-2 py-2 font-semibold text-gray-700">Pořadí</th>
                <th className="px-2 py-2 font-semibold text-gray-700">Resolver</th>
                <th className="px-2 py-2 font-semibold text-gray-700">Uživatel (pevný)</th>
                <th className="w-12 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {steps.map((row) => (
                <tr key={row.clientId} className="border-b border-gray-100">
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                      value={row.step_order}
                      onChange={(e) =>
                        updateStep(row.clientId, {
                          step_order: parseInt(e.target.value, 10) || 1,
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className="w-full min-w-[220px] rounded border border-gray-300 px-2 py-1 text-sm"
                      value={row.resolver}
                      onChange={(e) =>
                        updateStep(row.clientId, { resolver: e.target.value })
                      }
                    >
                      {resolverOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    {row.resolver === "fixed_user" ? (
                      <select
                        required
                        className="w-full min-w-[200px] rounded border border-gray-300 px-2 py-1 text-sm"
                        value={row.fixed_user_id ?? ""}
                        onChange={(e) =>
                          updateStep(row.clientId, {
                            fixed_user_id: e.target.value
                              ? parseInt(e.target.value, 10)
                              : null,
                          })
                        }
                      >
                        <option value="">— vyberte —</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.last_name} {u.first_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => removeStep(row.clientId)}
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                      title="Odstranit krok"
                      disabled={steps.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-red-600 px-5 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Ukládám…" : "Uložit"}
        </button>
        <Link
          href="/admin/contract-types"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="ml-auto rounded-lg border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Smazat typ
          </button>
        )}
      </div>
    </form>
  );
}

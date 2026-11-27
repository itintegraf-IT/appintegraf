"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

type Item = {
  id: number;
  request_number: string;
  status: string;
  status_label: string;
  project_name: string | null;
  vendor_company: string | null;
  contact_name: string | null;
  contact_email: string | null;
  due_date: string | null;
  submitted_at: string | null;
  created_at: string;
};

type SortField =
  | "created_at"
  | "due_date"
  | "status"
  | "project_name"
  | "vendor_company"
  | "request_number";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800",
  submitted: "bg-amber-100 text-amber-800",
  in_review: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-gray-200 text-gray-600",
};

export function ExterniDodavateleTab() {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortField>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        status,
        limit: "100",
        sort,
        order,
      });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/it-vendor-requests?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 403
            ? "Tuto záložku spravuje oddělení IT."
            : (data.error ?? "Nepodařilo se načíst seznam")
        );
        setItems([]);
      } else {
        setItems(data.items ?? []);
      }
    } catch {
      setError("Chyba sítě");
    }
    setLoading(false);
  }, [status, q, sort, order]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSort = (field: SortField) => {
    if (sort === field) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setOrder(field === "created_at" || field === "due_date" ? "desc" : "asc");
    }
  };

  const SortTh = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => {
    const active = sort === field;
    const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
    return (
      <th className="px-3 py-2">
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className={`inline-flex items-center gap-1 uppercase hover:text-gray-800 ${
            active ? "text-gray-900" : "text-gray-500"
          }`}
        >
          {children}
          <Icon className="h-3.5 w-3.5" />
        </button>
      </th>
    );
  };

  const createNew = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/it-vendor-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Nelze vytvořit");
      } else if (data.id) {
        window.location.href = `/pozadavky/externi/${data.id}/edit`;
        return;
      }
    } catch {
      setError("Chyba při vytváření");
    }
    setCreating(false);
  };

  const removeItem = async (item: Item) => {
    if (
      !window.confirm(
        `Opravdu trvale smazat požadavek ${item.request_number}?\nTuto akci nelze vrátit.`
      )
    ) {
      return;
    }
    setError("");
    try {
      const res = await fetch(`/api/it-vendor-requests/${item.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Smazání selhalo");
        return;
      }
      setItems((prev) => prev.filter((r) => r.id !== item.id));
    } catch {
      setError("Chyba při mazání");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Externí dodavatelé</h2>
          <p className="text-sm text-gray-600">
            Síťové a servisní požadavky pro technologie od externích firem
          </p>
        </div>
        <button
          type="button"
          onClick={() => void createNew()}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Nový požadavek
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Vše</option>
          <option value="open">Otevřené</option>
          <option value="draft">Koncept</option>
          <option value="sent">Odesláno dodavateli</option>
          <option value="submitted">Vyplněno dodavatelem</option>
          <option value="in_review">V kontrole IT</option>
          <option value="approved">Schváleno</option>
          <option value="rejected">Zamítnuto</option>
          <option value="cancelled">Zrušeno</option>
        </select>
        <input
          className="min-w-[200px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Hledat číslo, firmu, projekt…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load();
          }}
        />
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Obnovit
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <SortTh field="request_number">Číslo</SortTh>
              <SortTh field="status">Stav</SortTh>
              <SortTh field="project_name">Projekt</SortTh>
              <SortTh field="vendor_company">Dodavatel</SortTh>
              <th className="px-3 py-2">Kontakt</th>
              <SortTh field="due_date">Termín</SortTh>
              <SortTh field="created_at">Vytvořeno</SortTh>
              <th className="px-3 py-2 text-right">Akce</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                  Načítání…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                  Žádné požadavky
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/pozadavky/externi/${item.id}`}
                      className="font-medium text-red-600 hover:underline"
                    >
                      {item.request_number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[item.status] ?? "bg-gray-100"
                      }`}
                    >
                      {item.status_label}
                    </span>
                  </td>
                  <td className="px-3 py-2">{item.project_name || "—"}</td>
                  <td className="px-3 py-2">{item.vendor_company || "—"}</td>
                  <td className="px-3 py-2">
                    <div>{item.contact_name || "—"}</div>
                    <div className="text-xs text-gray-500">{item.contact_email}</div>
                  </td>
                  <td className="px-3 py-2">{item.due_date || "—"}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {new Date(item.created_at).toLocaleDateString("cs-CZ")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center justify-end gap-0.5">
                      <Link
                        href={`/pozadavky/externi/${item.id}`}
                        className="rounded p-2 text-gray-600 hover:bg-gray-100"
                        title="Detail / prohlížení"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/pozadavky/externi/${item.id}/edit`}
                        className="rounded p-2 text-gray-600 hover:bg-gray-100"
                        title="Upravit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        title="Smazat"
                        onClick={() => void removeItem(item)}
                        className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

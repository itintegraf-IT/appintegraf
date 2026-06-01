"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Trash2, ExternalLink } from "lucide-react";

type FoilRow = { id: number; material_id?: number; name: string; code: string | null; is_active: boolean };
type PantoneRow = {
  id: number;
  material_id?: number;
  name: string;
  code: string | null;
  pantone_code?: string | null;
  is_active: boolean;
};

const TABS = [
  { id: "custom" as const, label: "Vlastní pole" },
  { id: "foils" as const, label: "Fólie" },
  { id: "pantone" as const, label: "PANTONE" },
];

export function ImlCatalogSettingsClient({ customFieldsSlot }: { customFieldsSlot: React.ReactNode }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("custom");
  const [foils, setFoils] = useState<FoilRow[]>([]);
  const [pantones, setPantones] = useState<PantoneRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const loadFoils = () => {
    setLoading(true);
    fetch("/api/iml/foils")
      .then((r) => r.json())
      .then((d) => setFoils(d.foils ?? []))
      .finally(() => setLoading(false));
  };

  const loadPantones = () => {
    setLoading(true);
    fetch("/api/iml/pantone-colors")
      .then((r) => r.json())
      .then((d) => setPantones(d.pantone_colors ?? d.colors ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === "foils") loadFoils();
    if (tab === "pantone") loadPantones();
  }, [tab]);

  const addFoil = async () => {
    setError("");
    const res = await fetch("/api/iml/foils", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), code: code.trim() || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba");
      return;
    }
    setName("");
    setCode("");
    loadFoils();
  };

  const addPantone = async () => {
    setError("");
    const res = await fetch("/api/iml/pantone-colors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), code: code.trim() || null, pantone_code: code.trim() || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba");
      return;
    }
    setName("");
    setCode("");
    loadPantones();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === t.id ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
        <Link
          href="/materialy"
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          Katalog materiálů
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      {tab === "custom" && customFieldsSlot}

      {tab === "foils" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Sdíleno s{" "}
            <Link href="/materialy/foilie" className="text-red-600 hover:underline">
              katalogem fólií
            </Link>
            .
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Název fólie"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Kód"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addFoil}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Přidat
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Načítání…</p>
          ) : (
            <ul className="divide-y rounded-lg border border-gray-200">
              {foils.map((f) => (
                <li key={f.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>
                    {f.name}
                    {f.code ? <span className="ml-2 text-gray-500">({f.code})</span> : null}
                  </span>
                  <div className="flex gap-2">
                    {f.material_id ? (
                      <Link href={`/materialy/${f.material_id}`} className="text-red-600 hover:underline">
                        detail
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/iml/foils/${f.id}`, { method: "DELETE" });
                        loadFoils();
                      }}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "pantone" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Barvy PANTONE v{" "}
            <Link href="/materialy/barvy" className="text-red-600 hover:underline">
              katalogu barev
            </Link>
            .
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Název"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Kód PANTONE"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addPantone}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Přidat
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Načítání…</p>
          ) : (
            <ul className="divide-y rounded-lg border border-gray-200">
              {pantones.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>
                    {c.name}
                    {(c.code || c.pantone_code) && (
                      <span className="ml-2 text-gray-500">({c.code || c.pantone_code})</span>
                    )}
                  </span>
                  <div className="flex gap-2">
                    {c.material_id ? (
                      <Link href={`/materialy/${c.material_id}`} className="text-red-600 hover:underline">
                        detail
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/iml/pantone-colors/${c.id}`, { method: "DELETE" });
                        loadPantones();
                      }}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MATERIAL_CATEGORIES } from "@/lib/materialy/categories";

type Sub = {
  id: number;
  category_code: string;
  name: string;
  parent_id: number | null;
  sort_order: number;
  is_active: boolean;
};

export default function MaterialySettingsClient() {
  const [category, setCategory] = useState("FOIL");
  const [subs, setSubs] = useState<Sub[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    void (async () => {
      try {
        const r = await fetch(`/api/materialy/subcategories?category=${category}`);
        const d = (await r.json().catch(() => ({}))) as { subcategories?: Sub[] };
        setSubs(r.ok && Array.isArray(d.subcategories) ? d.subcategories : []);
      } catch {
        setSubs([]);
      }
    })();
  };

  useEffect(() => {
    load();
  }, [category]);

  const add = async () => {
    setError("");
    const res = await fetch("/api/materialy/subcategories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_code: category, name: name.trim(), sort_order: 0 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Chyba");
    else {
      setName("");
      load();
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Podtypy materiálu</h1>
        <Link href="/materialy" className="text-sm text-gray-500 hover:text-red-600">
          ← Katalog
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {MATERIAL_CATEGORIES.map((c: (typeof MATERIAL_CATEGORIES)[number]) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setCategory(c.code)}
            className={`rounded-lg px-3 py-2 text-sm ${
              category === c.code ? "bg-red-600 text-white" : "border border-gray-300"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Název podtypu (např. natíraný papír, typ fólie)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="button" onClick={add} className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white">
          Přidat
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border border-gray-200 bg-white">
        {subs.map((s) => (
          <li key={s.id} className="px-4 py-2 text-sm">
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

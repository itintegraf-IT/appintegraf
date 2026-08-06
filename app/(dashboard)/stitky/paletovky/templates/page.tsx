"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Template = {
  id: number;
  name: string;
  layout_variant: string;
  blocks_per_page: number;
  source_filename: string | null;
};

export default function PaletovkaTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    fetch("/api/stitky/paletovky/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []));
  }, []);

  return (
    <div>
      <Link href="/stitky/paletovky" className="mb-4 inline-block text-sm text-red-700 hover:underline">
        ← Paletovky
      </Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Šablony paletovek</h2>
      </div>

      <p className="mb-4 text-sm text-gray-600">
        Přehled dostupných šablon. Import a správu provádí administrátor v{" "}
        <Link href="/stitky/settings#paletovky-sablony" className="text-red-700 hover:underline">
          Nastavení
        </Link>
        .
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3">Název</th>
              <th className="px-4 py-3">Layout</th>
              <th className="px-4 py-3">Bloků</th>
              <th className="px-4 py-3">Zdroj</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Zatím žádné šablony
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3">{t.layout_variant}</td>
                  <td className="px-4 py-3">{t.blocks_per_page}</td>
                  <td className="px-4 py-3 text-gray-500">{t.source_filename ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

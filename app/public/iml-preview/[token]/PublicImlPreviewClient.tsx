"use client";

import { useEffect, useState } from "react";

type PreviewProduct = {
  id: number;
  ig_code: string | null;
  ig_short_name: string | null;
  client_name: string | null;
  client_code: string | null;
  has_softproof: boolean;
};

type MetaOk = {
  status: "ok";
  title: string | null;
  note: string | null;
  expires_at: string;
  products: PreviewProduct[];
};

export function PublicImlPreviewClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<MetaOk | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  const apiBase = `/api/public/iml-preview/${encodeURIComponent(token)}`;

  useEffect(() => {
    let cancelled = false;
    fetch(apiBase)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 410 || res.status === 404) {
          setBlocked(
            typeof data.message === "string" ? data.message : "Odkaz není platný"
          );
          return;
        }
        if (!res.ok || data.status !== "ok") {
          setBlocked(typeof data.error === "string" ? data.error : "Náhled nelze otevřít");
          return;
        }
        const ok = data as MetaOk;
        setMeta(ok);
        const firstWithImage = ok.products.find((p) => p.has_softproof);
        setActiveId(firstWithImage?.id ?? ok.products[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setBlocked("Nepodařilo se načíst náhled (síťová chyba).");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10 text-center text-slate-600">
        Načítám náhled…
      </main>
    );
  }

  if (blocked || !meta) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Náhled není dostupný</h1>
          <p className="mt-2 text-sm text-slate-600">{blocked ?? "Odkaz není platný"}</p>
        </div>
      </main>
    );
  }

  const active = meta.products.find((p) => p.id === activeId) ?? meta.products[0] ?? null;
  const title = meta.title?.trim() || "Náhled etiket";
  const expiresLabel = new Date(meta.expires_at).toLocaleString("cs-CZ");

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Integraf · náhled etiket
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
          {meta.note?.trim() && (
            <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-slate-600">
              {meta.note.trim()}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {meta.products.length} položek · platnost do {expiresLabel}
          </p>
        </header>

        {active && (
          <section className="mb-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex min-h-[280px] items-center justify-center bg-slate-50 p-4 sm:min-h-[420px]">
              {active.has_softproof ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${apiBase}/image/${active.id}`}
                  alt={active.ig_code ?? `etiketa-${active.id}`}
                  className="max-h-[70vh] max-w-full object-contain"
                />
              ) : (
                <p className="text-sm text-slate-500">Softproof není k dispozici</p>
              )}
            </div>
            <div className="border-t border-slate-100 px-4 py-3 sm:px-6">
              <p className="font-medium">{active.ig_code || `Produkt #${active.id}`}</p>
              <p className="text-sm text-slate-600">
                {[active.ig_short_name, active.client_name || active.client_code]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-700">Galerie</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {meta.products.map((p) => {
              const selected = p.id === active?.id;
              const label = p.ig_code || `#${p.id}`;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(p.id)}
                    className={`w-full overflow-hidden rounded-xl bg-white text-left shadow-sm ring-1 transition ${
                      selected
                        ? "ring-2 ring-sky-600"
                        : "ring-slate-200 hover:ring-slate-300"
                    }`}
                  >
                    <div className="flex aspect-square items-center justify-center bg-slate-50 p-2">
                      {p.has_softproof ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${apiBase}/image/${p.id}`}
                          alt={label}
                          className="max-h-full max-w-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <span className="px-2 text-center text-xs text-slate-400">
                          Bez softproofu
                        </span>
                      )}
                    </div>
                    <div className="border-t border-slate-100 px-2 py-2">
                      <p className="truncate text-xs font-medium">{label}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {p.ig_short_name || p.client_name || "—"}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PaletovkaForm } from "../_components/PaletovkaForm";
import { PaletovkaPreview } from "../_components/PaletovkaPreview";
import {
  emptyBlock,
  parsePaletovkaDocumentData,
  type PaletovkaDocumentData,
  type PaletovkaLayoutVariant,
} from "@/lib/stitky/paletovky/types";

type Template = {
  id: number;
  name: string;
  layout_variant: string;
  blocks_per_page: number;
};

export default function NewPaletovkaPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [data, setData] = useState<PaletovkaDocumentData>({ blocks: [emptyBlock()] });
  const [layoutVariant, setLayoutVariant] = useState<PaletovkaLayoutVariant>("single");
  const [blocksPerPage, setBlocksPerPage] = useState(1);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stitky/paletovky/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    if (templateId === "") {
      setData({ blocks: [emptyBlock()] });
      return;
    }

    setLoadingTemplate(true);
    setError(null);
    fetch(`/api/stitky/paletovky/templates/${templateId}`)
      .then((r) => r.json())
      .then((d) => {
        const t = d.template;
        if (!t) throw new Error("Šablona nenalezena");
        setLayoutVariant(t.layout_variant as PaletovkaLayoutVariant);
        setBlocksPerPage(t.blocks_per_page);
        const defaults = parsePaletovkaDocumentData(t.defaults_json);
        if (defaults) setData(defaults);
        setTitle((prev) => prev || t.name);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Načtení šablony selhalo");
      })
      .finally(() => setLoadingTemplate(false));
  }, [templateId]);

  const submit = async () => {
    if (templateId === "" || !title.trim()) {
      setError("Vyberte šablonu a zadejte název");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stitky/paletovky", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, title: title.trim(), data }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Vytvoření selhalo");
      router.push(`/stitky/paletovky/${json.paletovka.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
      setBusy(false);
    }
  };

  return (
    <div>
      <Link href="/stitky/paletovky" className="mb-4 inline-block text-sm text-red-700 hover:underline">
        ← Zpět
      </Link>
      <h2 className="mb-4 text-lg font-semibold">Nová paletovka</h2>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Šablona
          <select
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">— vyberte —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.layout_variant})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Název dokumentu
          <input
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      </div>

      {templates.length === 0 && (
        <p className="mb-4 text-sm text-gray-600">
          Zatím nejsou k dispozici žádné šablony. Administrátor je může přidat v{" "}
          <Link href="/stitky/settings#paletovky-sablony" className="text-red-700 hover:underline">
            Nastavení
          </Link>
          .
        </p>
      )}

      {templateId !== "" && (
        <>
          {loadingTemplate ? (
            <p className="mb-4 text-sm text-gray-500">Načítám šablonu…</p>
          ) : (
            <div className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Náhled šablony</h3>
              <PaletovkaPreview data={data} layoutVariant={layoutVariant} />
            </div>
          )}
          <PaletovkaForm
            layoutVariant={layoutVariant}
            blocksPerPage={blocksPerPage}
            initial={data}
            onChange={setData}
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || loadingTemplate}
            className="mt-6 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Ukládám…" : "Vytvořit paletovku"}
          </button>
        </>
      )}
    </div>
  );
}

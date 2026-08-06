"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LightPaletovkaTemplateEditor,
  parseLayoutForEditor,
} from "../../../_components/LightPaletovkaTemplateEditor";
import {
  parsePaletovkaDocumentData,
  type PaletovkaDocumentData,
  type PaletovkaLayoutVariant,
} from "@/lib/stitky/paletovky/types";

export default function EditPaletovkaTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [layoutVariant, setLayoutVariant] = useState<PaletovkaLayoutVariant>("single");
  const [blocksPerPage, setBlocksPerPage] = useState(1);
  const [defaults, setDefaults] = useState<PaletovkaDocumentData | null>(null);
  const [layoutJson, setLayoutJson] = useState<ReturnType<typeof parseLayoutForEditor> | null>(null);

  useEffect(() => {
    if (Number.isNaN(id)) return;
    fetch(`/api/stitky/paletovky/templates/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const t = d.template;
        if (!t) throw new Error("Šablona nenalezena");
        const parsed = parsePaletovkaDocumentData(t.defaults_json);
        if (!parsed) throw new Error("Neplatná data šablony");
        setName(t.name);
        setLayoutVariant(t.layout_variant as PaletovkaLayoutVariant);
        setBlocksPerPage(t.blocks_per_page);
        setDefaults(parsed);
        setLayoutJson(parseLayoutForEditor(t.layout_json));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Načtení selhalo"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <p className="text-sm text-gray-500">Načítám šablonu…</p>;
  }

  if (error || !defaults || !layoutJson) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
        {error ?? "Chyba"}
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/stitky/settings#paletovky-sablony"
        className="mb-4 inline-block text-sm text-red-700 hover:underline"
      >
        ← Nastavení
      </Link>
      <h2 className="mb-4 text-lg font-semibold">Úprava šablony paletovky</h2>
      <LightPaletovkaTemplateEditor
        templateId={id}
        initialName={name}
        layoutVariant={layoutVariant}
        blocksPerPage={blocksPerPage}
        initialDefaults={defaults}
        initialLayoutJson={layoutJson}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

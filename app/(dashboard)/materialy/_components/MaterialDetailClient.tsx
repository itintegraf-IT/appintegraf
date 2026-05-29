"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Archive, Trash2 } from "lucide-react";
import { materialCategorySlug } from "@/lib/materialy/categories";
import { MaterialyLiveAttachmentUploader } from "./MaterialyAttachmentFields";

function categoryListHref(material: Record<string, unknown> | null): string {
  const cat = material?.material_categories as { slug?: string | null } | undefined;
  if (cat?.slug) return `/materialy/kategorie/${cat.slug}`;
  const code = String(material?.category_code ?? "");
  return `/materialy/kategorie/${materialCategorySlug(code)}`;
}

type FileRow = {
  id: number;
  original_filename: string;
  document_type: string | null;
  file_path: string;
  created_at: string;
  users?: { first_name: string; last_name: string };
};

export function MaterialDetailClient({ id, canWrite }: { id: number; canWrite: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [material, setMaterial] = useState<Record<string, unknown> | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [actionError, setActionError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [fileDeletingId, setFileDeletingId] = useState<number | null>(null);
  const [uploadBanner, setUploadBanner] = useState<{ text: string; variant: "success" | "warning" } | null>(
    null
  );

  const load = useCallback(() => {
    setLoadError("");
    void (async () => {
      try {
        const [rMat, rFiles] = await Promise.all([
          fetch(`/api/materialy/${id}`),
          fetch(`/api/materialy/${id}/files`),
        ]);
        const dMat = (await rMat.json().catch(() => ({}))) as { material?: Record<string, unknown>; error?: string };
        const dFiles = (await rFiles.json().catch(() => ({}))) as { files?: FileRow[] };
        if (!rMat.ok) {
          setMaterial(null);
          setFiles([]);
          setLoadError(typeof dMat.error === "string" ? dMat.error : "Materiál se nepodařilo načíst.");
          return;
        }
        setMaterial(dMat.material ?? null);
        setFiles(rFiles.ok && Array.isArray(dFiles.files) ? dFiles.files : []);
      } catch {
        setMaterial(null);
        setFiles([]);
        setLoadError("Chyba při načítání.");
      }
    })();
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const nRaw = searchParams.get("nahrano");
    const chRaw = searchParams.get("nahrChyb");
    if (nRaw === null && chRaw === null) return;

    const ok = nRaw !== null ? parseInt(nRaw, 10) : NaN;
    const fail = chRaw ? parseInt(chRaw, 10) : 0;

    if (Number.isFinite(ok) && ok > 0) {
      setUploadBanner({
        variant: "success",
        text:
          fail > 0
            ? `Nahráno ${ok} ${ok === 1 ? "soubor" : "souborů"}, ${fail} se nepodařilo.`
            : `Nahráno ${ok} ${ok === 1 ? "soubor" : "souborů"}.`,
      });
    } else if (fail > 0) {
      setUploadBanner({
        variant: "warning",
        text: `Materiál byl uložen, ale ${fail} ${fail === 1 ? "soubor se nepodařilo" : fail < 5 ? "soubory se nepodařilo" : "souborů se nepodařilo"} nahrát. Dokumenty můžete doplnit níže.`,
      });
    }

    router.replace(`/materialy/${id}`, { scroll: false });
  }, [id, router, searchParams]);

  const onDeleteFile = async (fileId: number, name: string) => {
    if (!confirm(`Smazat přílohu „${name}“? Soubor bude odstraněn z disku i z evidence.`)) return;
    setFileDeletingId(fileId);
    setActionError("");
    try {
      const res = await fetch(`/api/materialy/${id}/files/${fileId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(typeof data.error === "string" ? data.error : "Smazání se nezdařilo");
        return;
      }
      load();
    } finally {
      setFileDeletingId(null);
    }
  };

  const onDeactivate = async () => {
    if (
      !confirm(
        "Skrýt tento materiál v katalogu? Záznam zůstane v databázi (např. u již napojených produktů IML), ale přestane se nabízet ve výběrech."
      )
    ) {
      return;
    }
    setDeleting(true);
    setActionError("");
    const res = await fetch(`/api/materialy/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(typeof data.error === "string" ? data.error : "Chyba při skrytí");
      setDeleting(false);
      return;
    }
    router.push(categoryListHref(material));
    router.refresh();
  };

  const onDeletePermanent = async () => {
    if (
      !confirm(
        "Trvale smazat tento materiál? Akci nelze vrátit. Pokud je materiál použit u produktů IML, smazání nebude možné."
      )
    ) {
      return;
    }
    setDeleting(true);
    setActionError("");
    const res = await fetch(`/api/materialy/${id}?permanent=1`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(typeof data.error === "string" ? data.error : "Smazání se nezdařilo");
      setDeleting(false);
      return;
    }
    router.push(categoryListHref(material));
    router.refresh();
  };

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!material) return <p className="text-sm text-gray-500">Načítání…</p>;

  const subcat =
    material.material_subcategories &&
    typeof material.material_subcategories === "object" &&
    material.material_subcategories !== null &&
    "name" in material.material_subcategories
      ? String((material.material_subcategories as { name: string }).name)
      : "—";

  const fmt = (v: unknown) => {
    if (v == null || v === "") return "—";
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("cs-CZ");
  };

  const fmtDt = (v: unknown) => {
    if (v == null || v === "") return "—";
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("cs-CZ");
  };

  const isInactive = material.is_active === false;

  return (
    <div className="space-y-6">
      {uploadBanner ? (
        <p
          className={
            uploadBanner.variant === "success"
              ? "rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-900"
              : "rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
          }
          role="status"
        >
          {uploadBanner.text}
        </p>
      ) : null}

      {isInactive ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Tento materiál je v katalogu <strong>neaktivní</strong> (skrytý ve výběrech). Obnovit ho můžete úpravou
          záznamu a zaškrtnutím „Aktivní v katalogu“.
        </p>
      ) : null}

      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{String(material.name)}</h2>
          {canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/materialy/${id}/edit`}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50"
              >
                <Pencil className="h-4 w-4" />
                Upravit
              </Link>
              {!isInactive ? (
                <button
                  type="button"
                  onClick={() => void onDeactivate()}
                  disabled={deleting}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Archive className="h-4 w-4" />
                  {deleting ? "…" : "Skrýt"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void onDeletePermanent()}
                disabled={deleting}
                className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-800 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "…" : "Smazat"}
              </button>
            </div>
          ) : null}
        </div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Podtyp</dt>
            <dd>{subcat}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Kód</dt>
            <dd>{String(material.code ?? "—")}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Kategorie</dt>
            <dd>{String(material.category_code)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Výrobce</dt>
            <dd>{String(material.manufacturer ?? "—")}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Dodavatel</dt>
            <dd>{String(material.supplier ?? "—")}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Číslo CAS</dt>
            <dd>{String(material.cas_number ?? "—")}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Datum vložení</dt>
            <dd>{fmtDt(material.created_at)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Vystavení</dt>
            <dd>{fmt(material.issued_at)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Platnost</dt>
            <dd>{fmt(material.valid_until)}</dd>
          </div>
        </dl>
        {material.notes ? (
          <p className="mt-4 text-sm text-gray-700">
            <span className="font-medium text-gray-500">Poznámky: </span>
            <span className="whitespace-pre-wrap">{String(material.notes)}</span>
          </p>
        ) : null}
        {material.description ? (
          <p className="mt-4 text-sm text-gray-700 whitespace-pre-wrap">{String(material.description)}</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-3 font-semibold">Dokumenty (BL, TDS, …)</h3>
        {canWrite ? (
          <div className="mb-4">
            <MaterialyLiveAttachmentUploader materialId={id} onUploaded={load} />
          </div>
        ) : null}
        <ul className="divide-y text-sm">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {f.original_filename}{" "}
                <span className="text-gray-400">({f.document_type ?? "—"})</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <a href={f.file_path} target="_blank" rel="noreferrer" className="text-red-600 hover:underline">
                  Stáhnout
                </a>
                {canWrite ? (
                  <button
                    type="button"
                    disabled={fileDeletingId === f.id}
                    onClick={() => void onDeleteFile(f.id, f.original_filename)}
                    className="text-gray-600 underline-offset-2 hover:text-red-700 hover:underline disabled:opacity-50"
                  >
                    {fileDeletingId === f.id ? "…" : "Smazat"}
                  </button>
                ) : null}
              </span>
            </li>
          ))}
          {files.length === 0 && <li className="py-2 text-gray-500">Žádné dokumenty</li>}
        </ul>
      </div>

      <Link href="/materialy" className="text-sm text-gray-500 hover:text-red-600">
        ← Zpět na katalog
      </Link>
    </div>
  );
}

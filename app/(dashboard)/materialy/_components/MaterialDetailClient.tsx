"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Archive } from "lucide-react";
import { DOCUMENT_TYPES, materialCategorySlug } from "@/lib/materialy/categories";

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
  const [material, setMaterial] = useState<Record<string, unknown> | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [docType, setDocType] = useState("SDS");
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [actionError, setActionError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = () => {
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
  };

  useEffect(() => {
    load();
  }, [id]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFileError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("document_type", docType);
    const res = await fetch(`/api/materialy/${id}/files`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setFileError(typeof data.error === "string" ? data.error : "Chyba nahrání");
    else load();
    setUploading(false);
    e.target.value = "";
  };

  const onDeactivate = async () => {
    if (
      !confirm(
        "Deaktivovat tento materiál v katalogu? Záznam zůstane v databázi (např. u již napojených produktů IML), ale přestane se nabízet ve výběrech."
      )
    ) {
      return;
    }
    setDeleting(true);
    setActionError("");
    const res = await fetch(`/api/materialy/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(typeof data.error === "string" ? data.error : "Chyba při deaktivaci");
      setDeleting(false);
      return;
    }
    const cat = String(material?.category_code ?? "");
    router.push(`/materialy/${materialCategorySlug(cat)}`);
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

  const isInactive = material.is_active === false;

  return (
    <div className="space-y-6">
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
                  onClick={onDeactivate}
                  disabled={deleting}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <Archive className="h-4 w-4" />
                  {deleting ? "…" : "Deaktivovat"}
                </button>
              ) : null}
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
            <dt className="text-gray-500">Platnost BL / SDS</dt>
            <dd>{fmt(material.valid_until)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Platnost certifikátu</dt>
            <dd>{fmt(material.certificate_valid_until)}</dd>
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
        {fileError && <p className="mb-2 text-sm text-red-600">{fileError}</p>}
        {canWrite && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
            >
              {DOCUMENT_TYPES.map((t: (typeof DOCUMENT_TYPES)[number]) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
              {uploading ? "Nahrávám…" : "Nahrát soubor"}
              <input type="file" className="hidden" onChange={onUpload} disabled={uploading} />
            </label>
          </div>
        )}
        <ul className="divide-y text-sm">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between py-2">
              <span>
                {f.original_filename}{" "}
                <span className="text-gray-400">({f.document_type ?? "—"})</span>
              </span>
              <a href={f.file_path} target="_blank" rel="noreferrer" className="text-red-600 hover:underline">
                Stáhnout
              </a>
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

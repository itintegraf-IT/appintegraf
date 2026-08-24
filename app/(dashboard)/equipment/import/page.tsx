"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, Upload } from "lucide-react";

type Preview = {
  stats: {
    categoriesCreate: number;
    categoriesReuse: number;
    roomsCreate: number;
    roomsReuse: number;
    itemsCreate: number;
    itemsSkip: number;
  };
  categoriesToCreate: {
    name: string;
    code: string;
    responsibleLabel: string | null;
  }[];
  roomsToCreate: { code: string; name: string }[];
  itemsSample: {
    assetTag: string;
    name: string;
    categoryName: string;
    quantity: number;
    year: number | null;
    location: string | null;
  }[];
  itemsToSkipSample: { assetTag: string; name: string; reason: string }[];
  warnings: string[];
  errors: string[];
  blocked: boolean;
};

type CommitResult = {
  categoriesCreated: number;
  roomsCreated: number;
  itemsCreated: number;
  itemsSkipped: number;
  warnings: string[];
};

export default function EquipmentImportClient() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);

  const reset = () => {
    setPreview(null);
    setResult(null);
    setError("");
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      setError("Povolené formáty: .xlsx, .xls");
      return;
    }
    setFile(f);
    reset();
  };

  const send = useCallback(
    async (url: string, mode: "preview" | "commit") => {
      if (!file) {
        setError("Vyberte soubor Excel");
        return;
      }
      setError("");
      setLoading(mode);
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch(url, { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Požadavek selhal");
          return;
        }
        if (mode === "preview") {
          setPreview(data as Preview);
          setResult(null);
        } else {
          setResult(data as CommitResult);
        }
      } catch {
        setError("Nepodařilo se spojit se serverem");
      } finally {
        setLoading(null);
      }
    },
    [file]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import majetku z Excelu</h1>
          <p className="mt-1 text-gray-600">
            Záložky majetek, kategorie a místnosti. Položky vzniknou jako nezařazené (bez místnosti),
            původní umístění se uloží jako nápověda pro inventuru.
          </p>
        </div>
        <Link
          href="/equipment"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {result ? (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-900">
          <p className="font-medium">Import dokončen.</p>
          <ul className="mt-2 list-inside list-disc">
            <li>Skupiny: {result.categoriesCreated}</li>
            <li>Místnosti: {result.roomsCreated}</li>
            <li>Položky (nezařazené): {result.itemsCreated}</li>
            <li>Přeskočeno (už existuje): {result.itemsSkipped}</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/equipment?scope=all&unassigned=1"
              className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
            >
              Zobrazit nezařazený majetek
            </Link>
            <Link
              href="/equipment?scope=all"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Celý seznam
            </Link>
          </div>
        </div>
      ) : null}

      <div
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFile(e.dataTransfer.files?.[0]);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? "border-red-400 bg-red-50" : "border-gray-300 bg-gray-50 hover:border-gray-400"
        }`}
      >
        <FileSpreadsheet className="mx-auto mb-2 h-10 w-10 text-gray-500" />
        <p className="mb-2 text-sm font-medium text-gray-700">
          Přetáhněte soubor sem nebo klikněte pro výběr
        </p>
        <p className="mb-4 text-xs text-gray-500">Excel .xlsx / .xls (vzor: Podklady pro inventuru majetku)</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Vybrat soubor
        </button>
        {file ? (
          <p className="mt-2 text-sm text-gray-600">
            <strong>{file.name}</strong>
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!file || loading != null}
          onClick={() => send("/api/equipment/import/preview", "preview")}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading === "preview" ? "Načítám náhled…" : "Náhled"}
        </button>
        <button
          type="button"
          disabled={!file || !preview || preview.blocked || loading != null || !!result}
          onClick={() => send("/api/equipment/import", "commit")}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {loading === "commit" ? "Importuji…" : "Importovat nezařazený majetek"}
        </button>
      </div>

      {preview ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Položky k založení"
              value={preview.stats.itemsCreate}
              hint={`přeskočit ${preview.stats.itemsSkip}`}
            />
            <Stat
              label="Skupiny"
              value={preview.stats.categoriesCreate}
              hint={`už existuje ${preview.stats.categoriesReuse}`}
            />
            <Stat
              label="Místnosti (číselník)"
              value={preview.stats.roomsCreate}
              hint={`už existuje ${preview.stats.roomsReuse}`}
            />
          </div>

          {preview.errors.length > 0 ? (
            <Box title="Chyby" tone="red" items={preview.errors} />
          ) : null}
          {preview.warnings.length > 0 ? (
            <Box title="Upozornění" tone="amber" items={preview.warnings} />
          ) : null}

          {preview.categoriesToCreate.length > 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 font-semibold text-gray-900">Nové skupiny</h2>
              <ul className="text-sm text-gray-700">
                {preview.categoriesToCreate.map((c) => (
                  <li key={c.code}>
                    {c.name} <span className="font-mono text-xs text-gray-500">({c.code})</span>
                    {c.responsibleLabel ? ` — ${c.responsibleLabel}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.itemsSample.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <h2 className="border-b border-gray-100 px-4 py-3 font-semibold text-gray-900">
                Vzorek položek (nezařazené)
              </h2>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-2">Inv. č.</th>
                    <th className="px-4 py-2">Název</th>
                    <th className="px-4 py-2">Skupina</th>
                    <th className="px-4 py-2">Ks</th>
                    <th className="px-4 py-2">Rok</th>
                    <th className="px-4 py-2">Původní umístění</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.itemsSample.map((row) => (
                    <tr key={row.assetTag} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-mono">{row.assetTag}</td>
                      <td className="px-4 py-2">{row.name}</td>
                      <td className="px-4 py-2">{row.categoryName}</td>
                      <td className="px-4 py-2">{row.quantity}</td>
                      <td className="px-4 py-2">{row.year ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-600">{row.location ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {preview.itemsToSkipSample.length > 0 ? (
            <Box
              title="Přeskočené (už v evidenci)"
              tone="gray"
              items={preview.itemsToSkipSample.map(
                (s) => `${s.assetTag} — ${s.name} (${s.reason})`
              )}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{hint}</p>
    </div>
  );
}

function Box({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "red" | "amber" | "gray";
  items: string[];
}) {
  const cls =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-gray-200 bg-gray-50 text-gray-800";
  const shown = items.slice(0, 30);
  return (
    <div className={`rounded-xl border p-4 text-sm ${cls}`}>
      <p className="font-semibold">
        {title} ({items.length})
      </p>
      <ul className="mt-2 list-inside list-disc">
        {shown.map((item, i) => (
          <li key={`${i}-${item.slice(0, 40)}`}>{item}</li>
        ))}
      </ul>
      {items.length > shown.length ? (
        <p className="mt-1 text-xs">…a dalších {items.length - shown.length}</p>
      ) : null}
    </div>
  );
}

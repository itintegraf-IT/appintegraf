"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  FileArchive,
  FolderOpen,
  FileSpreadsheet,
  GripVertical,
  AlertTriangle,
} from "lucide-react";
import {
  appendFolderFilesToFormData,
  buildLightPreviewFormData,
  cancelFolderImportSession,
  estimateFormDataBytes,
  executeFolderImportInBatches,
  findProductsCsvInFileList,
  formatImportApiError,
  formatImportSize,
  postFormDataWithProgress,
  sumFileListBytes,
  validateZipImportSizeClient,
  type UploadProgressState,
} from "@/lib/iml-product-import-client";
import {
  IML_PRODUCT_IMPORT_BATCH_MAX_MB,
  IML_PRODUCT_IMPORT_MAX_MB,
} from "@/lib/iml-product-import-limits";

const TARGET_FIELDS = [
  { key: "ig_code", label: "Kód IG (IMLEXport: code)", required: false },
  { key: "ig_short_name", label: "Zkrácený název (IG)", required: false },
  { key: "client_code", label: "Kód u klienta", required: false },
  { key: "client_name", label: "Název u klienta", required: false },
  { key: "sku", label: "SKU", required: false },
  { key: "customer_name", label: "Zákazník (pro párování)", required: false },
  { key: "requester", label: "Zadavatel", required: false },
  { key: "label_shape_code", label: "Kód tvaru etikety", required: false },
  { key: "product_format", label: "Rozměr/formát (text)", required: false },
  { key: "format_width_mm", label: "Formát š (mm)", required: false },
  { key: "format_height_mm", label: "Formát v (mm)", required: false },
  { key: "die_cut_tool_code", label: "Kód výsekového nástroje", required: false },
  { key: "assembly_code", label: "Kód montáže", required: false },
  { key: "positions_on_sheet", label: "Pozic na archu", required: false },
  { key: "pieces_per_box", label: "Kusů v krabici", required: false },
  { key: "pieces_per_pallet", label: "Kusů na paletě", required: false },
  { key: "foil_type", label: "Druh fólie", required: false },
  { key: "foil_material_id", label: "ID fólie (katalog)", required: false },
  { key: "color_coverage", label: "Barevnost / pokrytí", required: false },
  { key: "color_material_id", label: "ID barvy (katalog)", required: false },
  { key: "paper_material_id", label: "ID papíru (katalog)", required: false },
  { key: "lacquer_material_id", label: "ID laku (katalog)", required: false },
  { key: "print_note", label: "Poznámka k tisku", required: false },
  { key: "ean_code", label: "EAN kód", required: false },
  { key: "production_notes", label: "Výrobní poznámky", required: false },
  { key: "item_status", label: "Stav položky", required: false },
  { key: "approval_status", label: "Stav schválení", required: false },
  { key: "approval_date", label: "Datum schválení (YYYY-MM-DD)", required: false },
  { key: "color_count", label: "Počet barev (1–8)", required: false },
  { key: "print_colors_text", label: "Barvy (souhrn)", required: false },
  { key: "label_type", label: "Etiketa (rezana/s_vysekem)", required: false },
  { key: "has_print_sample", label: "Vzor min. tisku (ano/1)", required: false },
  { key: "has_print_proof", label: "Nátisk (ano/1)", required: false },
] as const;

type Mapping = Record<string, number>;
type ConflictResolution = "import" | "overwrite" | "skip";

type PreviewConflict = {
  rowIndex: number;
  igCode: string;
  csvName: string;
  existing: {
    id: number;
    ig_code: string | null;
    client_name: string | null;
    customer_id: number | null;
  };
};

type FileIndexSummary = {
  total: number;
  print: number;
  preview: number;
  unknown: number;
  unmatchedCodes: string[];
};

type Step = "upload" | "mapping" | "conflicts" | "done";

type ExecuteResult = {
  created: number;
  updated: number;
  skipped: number;
  imported: number;
  errors: string[];
  files: {
    printAttached: number;
    previewAttached: number;
    skippedNoProduct: number;
    errors: string[];
  };
};

export default function ImlProductsImportPage() {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [folderFiles, setFolderFiles] = useState<File[] | null>(null);
  const [folderLabel, setFolderLabel] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [csvPath, setCsvPath] = useState("");
  const [rowCount, setRowCount] = useState(0);
  const [fileIndex, setFileIndex] = useState<FileIndexSummary | null>(null);
  const [conflicts, setConflicts] = useState<PreviewConflict[]>([]);
  const [defaultAction, setDefaultAction] = useState<ConflictResolution>("skip");
  const [byCode, setByCode] = useState<Record<string, ConflictResolution>>({});

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const importSessionIdRef = useRef<string | null>(null);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [legacyResult, setLegacyResult] = useState<{ imported: number; errors: string[] } | null>(
    null
  );

  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggedCol, setDraggedCol] = useState<number | null>(null);
  const [showLegacy, setShowLegacy] = useState(false);

  const hasImportSource = Boolean(
    (folderFiles && folderFiles.length > 0) || zipFile
  );

  const importSizeLabel = folderFiles?.length
    ? `${folderFiles.length} souborů, ${formatImportSize(sumFileListBytes(folderFiles))}`
    : zipFile
      ? formatImportSize(zipFile.size)
      : "";

  const resetImportFlow = () => {
    setStep("upload");
    setFolderFiles(null);
    setFolderLabel("");
    setZipFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setCsvPath("");
    setRowCount(0);
    setFileIndex(null);
    setConflicts([]);
    setByCode({});
    setDefaultAction("skip");
    setResult(null);
    setError("");
    if (folderInputRef.current) folderInputRef.current.value = "";
    if (zipInputRef.current) zipInputRef.current.value = "";
  };

  type ImportSource = { folderFiles?: File[] | null; zipFile?: File | null };

  const buildExecuteFormData = () => {
    const formData = new FormData();
    if (folderFiles?.length) {
      appendFolderFilesToFormData(formData, folderFiles);
    } else if (zipFile) {
      formData.append("zip", zipFile);
      formData.append("source", "zip");
    }
    formData.append("mapping", JSON.stringify(mapping));
    formData.append(
      "resolutions",
      JSON.stringify({ default: defaultAction, byCode })
    );
    return formData;
  };

  const buildPreviewFormData = (
    files: File[] | null | undefined,
    zip: File | null | undefined,
    mappingOverride?: Mapping,
    withConflicts = false
  ) => {
    if (files?.length) {
      return buildLightPreviewFormData(files, {
        mapping: mappingOverride ?? mapping,
        checkConflicts: withConflicts,
      });
    }
    const formData = new FormData();
    if (zip) {
      formData.append("zip", zip);
      formData.append("source", "zip");
    }
    formData.append("mapping", JSON.stringify(mappingOverride ?? mapping));
    if (withConflicts) formData.append("checkConflicts", "true");
    return formData;
  };

  const progressLabel = useMemo(() => {
    if (!uploadProgress) {
      return loading ? "Zpracovávám…" : null;
    }
    if (uploadProgress.phase === "processing") {
      return step === "conflicts" || step === "mapping"
        ? "Importuji produkty na serveru…"
        : "Zpracovávám náhled na serveru…";
    }
    const batchLabel =
      uploadProgress.batchIndex && uploadProgress.batchCount
        ? `Dávka ${uploadProgress.batchIndex}/${uploadProgress.batchCount} · `
        : "";
    return `${batchLabel}Nahrávám data… ${formatImportSize(uploadProgress.loaded)} / ${formatImportSize(uploadProgress.total)} (${uploadProgress.percent} %)`;
  }, [uploadProgress, loading, step]);

  const cancelUpload = () => {
    const sessionId = importSessionIdRef.current;
    importSessionIdRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    if (sessionId) {
      void cancelFolderImportSession(sessionId);
    }
    setLoading(false);
    setUploadProgress(null);
    setError("Nahrávání zrušeno");
  };

  const loadPreview = useCallback(
    async (
      withConflicts = false,
      mappingOverride?: Mapping,
      source?: ImportSource
    ) => {
      const files = source?.folderFiles ?? folderFiles;
      const zip = source?.zipFile !== undefined ? source.zipFile : zipFile;
      if (zip) {
        const sizeErr = validateZipImportSizeClient(zip);
        if (sizeErr) {
          setError(sizeErr);
          return;
        }
      }
      if (!files?.length && !zip) {
        setError("Vyberte složku nebo ZIP");
        return;
      }
      if (files?.length && !findProductsCsvInFileList(files)) {
        setError("Ve složce chybí soubor products.csv");
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setUploadProgress(null);
      setError("");
      try {
        const formData = buildPreviewFormData(
          files,
          zip,
          mappingOverride,
          withConflicts
        );
        const uploadBytes =
          files?.length && findProductsCsvInFileList(files)
            ? findProductsCsvInFileList(files)!.file.size + 4096
            : estimateFormDataBytes(files ?? null, zip);

        const { ok, data } = await postFormDataWithProgress(
          "/api/iml/products/import/preview",
          formData,
          {
            signal: controller.signal,
            timeoutMs: files?.length ? 120_000 : 300_000,
            onProgress: (p) => {
              setUploadProgress({
                ...p,
                total: p.total || uploadBytes,
              });
            },
          }
        );

        if (!ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Chyba při náhledu"
          );
        }

        setHeaders((data.headers as string[]) ?? []);
        setRows((data.previewRows as string[][]) ?? []);
        setCsvPath((data.csvRelativePath as string) ?? "");
        setRowCount((data.rowCount as number) ?? 0);
        setFileIndex((data.fileIndex as FileIndexSummary) ?? null);
        if (data.suggestedMapping && !withConflicts) {
          setMapping(data.suggestedMapping as Mapping);
        }
        if (withConflicts) {
          setConflicts((data.conflicts as PreviewConflict[]) ?? []);
          setStep("conflicts");
        } else {
          setStep("mapping");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Chyba při načtení dat");
        setStep("upload");
      } finally {
        setLoading(false);
        setUploadProgress(null);
        abortRef.current = null;
      }
    },
    [mapping, folderFiles, zipFile]
  );

  const handleFolderChange = async (list: FileList | null) => {
    if (!list?.length) {
      resetImportFlow();
      return;
    }
    const files = Array.from(list);
    const firstPath =
      (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath || "";
    const rootName = firstPath.split("/")[0] || "složka";

    setFolderFiles(files);
    setFolderLabel(rootName);
    setZipFile(null);
    setResult(null);
    setMapping({});
    setByCode({});
    if (zipInputRef.current) zipInputRef.current.value = "";
    await loadPreview(false, {}, { folderFiles: files, zipFile: null });
  };

  const handleZipChange = async (f: File | null) => {
    if (!f) {
      resetImportFlow();
      return;
    }
    if (!f.name.toLowerCase().endsWith(".zip")) {
      setError("Očekáván soubor .zip");
      return;
    }
    const sizeErr = validateZipImportSizeClient(f);
    if (sizeErr) {
      setError(sizeErr);
      return;
    }
    setZipFile(f);
    setFolderFiles(null);
    setFolderLabel("");
    setResult(null);
    setMapping({});
    setByCode({});
    if (folderInputRef.current) folderInputRef.current.value = "";
    await loadPreview(false, {}, { folderFiles: null, zipFile: f });
  };

  const onDropTarget = (fieldKey: string) => {
    setDragOver(null);
    if (draggedCol !== null) {
      setMapping((m) => ({ ...m, [fieldKey]: draggedCol }));
      setDraggedCol(null);
    }
  };

  const removeMapping = (fieldKey: string) => {
    setMapping((m) => {
      const next = { ...m };
      delete next[fieldKey];
      return next;
    });
  };

  const canCheckConflicts = () => {
    const hasIgCode = typeof mapping.ig_code === "number" && mapping.ig_code >= 0;
    const hasClientName = typeof mapping.client_name === "number" && mapping.client_name >= 0;
    const hasIgShortName = typeof mapping.ig_short_name === "number" && mapping.ig_short_name >= 0;
    return hasImportSource && (hasIgCode || hasClientName || hasIgShortName);
  };

  const handleCheckConflicts = async () => {
    if (!canCheckConflicts()) return;
    await loadPreview(true, mapping);
  };

  const setRowAction = (code: string, action: ConflictResolution) => {
    setByCode((prev) => ({ ...prev, [code]: action }));
  };

  const applyExecuteResult = (data: Record<string, unknown>) => {
    setResult({
      created: (data.created as number) ?? 0,
      updated: (data.updated as number) ?? 0,
      skipped: (data.skipped as number) ?? 0,
      imported: (data.imported as number) ?? 0,
      errors: (data.errors as string[]) ?? [],
      files: (data.files as ExecuteResult["files"]) ?? {
        printAttached: 0,
        previewAttached: 0,
        skippedNoProduct: 0,
        errors: [],
      },
    });
    setStep("done");
  };

  const handleExecute = async () => {
    if (!hasImportSource) return;
    if (zipFile) {
      const sizeErr = validateZipImportSizeClient(zipFile);
      if (sizeErr) {
        setError(sizeErr);
        return;
      }
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    importSessionIdRef.current = null;

    setLoading(true);
    setUploadProgress(null);
    setError("");
    setResult(null);
    try {
      let ok: boolean;
      let data: Record<string, unknown>;
      let status = 0;
      let responseText: string | undefined;

      if (folderFiles?.length) {
        ({ ok, data, status, responseText } = await executeFolderImportInBatches(folderFiles, {
          mapping,
          resolutions: { default: defaultAction, byCode },
          signal: controller.signal,
          timeoutMs: 600_000,
          onSessionCreated: (id) => {
            importSessionIdRef.current = id;
          },
          onProgress: setUploadProgress,
        }));
        importSessionIdRef.current = null;
      } else {
        const formData = buildExecuteFormData();
        const totalBytes = estimateFormDataBytes(folderFiles, zipFile);
        ({ ok, data, status, responseText } = await postFormDataWithProgress(
          "/api/iml/products/import/execute",
          formData,
          {
            signal: controller.signal,
            timeoutMs: 600_000,
            onProgress: (p) => {
              setUploadProgress({
                ...p,
                total: p.total || totalBytes,
              });
            },
          }
        ));
      }

      if (!ok) {
        throw new Error(formatImportApiError(status, data, responseText));
      }

      applyExecuteResult(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Chyba při importu");
    } finally {
      setLoading(false);
      setUploadProgress(null);
      abortRef.current = null;
      importSessionIdRef.current = null;
    }
  };

  const handleLegacyCsvImport = async (file: File, legacyMapping: Mapping) => {
    setLoading(true);
    setError("");
    setLegacyResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(legacyMapping));
      const res = await fetch("/api/iml/products/import", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při importu");
      setLegacyResult({ imported: data.imported, errors: data.errors ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při importu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import produktů (složka / ZIP)</h1>
          <p className="mt-1 text-gray-600">
            Složka z IMLEXportu (doporučeno) nebo ZIP: products.csv, tisková data a náhledy.
            Kódy produktů: formát <code className="rounded bg-gray-100 px-1">NN-NN-NNN</code> nebo
            6místné (<code className="rounded bg-gray-100 px-1">498056</code>). CSV s oddělovačem{" "}
            <code className="rounded bg-gray-100 px-1">,</code> nebo{" "}
            <code className="rounded bg-gray-100 px-1">;</code>.
          </p>
        </div>
        <Link
          href="/iml/products"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading && progressLabel && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-900">{progressLabel}</p>
          {uploadProgress?.phase === "uploading" && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>
          )}
          {uploadProgress?.phase === "uploading" && (
            <button
              type="button"
              onClick={cancelUpload}
              className="mt-2 text-sm text-blue-800 underline hover:text-blue-950"
            >
              Zrušit nahrávání
            </button>
          )}
        </div>
      )}

      {step === "done" && result && (
        <div className="mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">Import dokončen</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Vytvořeno: {result.created}</li>
            <li>Aktualizováno: {result.updated}</li>
            <li>Přeskočeno (CSV): {result.skipped}</li>
            <li>
              Soubory – tisk: {result.files.printAttached}, náhled:{" "}
              {result.files.previewAttached}, bez produktu: {result.files.skippedNoProduct}
            </li>
          </ul>
          {(result.errors.length > 0 || result.files.errors.length > 0) && (
            <div className="mt-3 text-amber-800">
              <p className="font-medium">Upozornění:</p>
              <ul className="mt-1 max-h-40 list-inside list-disc overflow-y-auto text-xs">
                {[...result.errors, ...result.files.errors].slice(0, 15).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={resetImportFlow}
            className="mt-4 rounded-lg border border-green-700 px-3 py-1.5 text-green-900 hover:bg-green-100"
          >
            Nový import
          </button>
        </div>
      )}

      {step === "upload" && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8">
          <div className="mx-auto max-w-lg text-center">
            <FolderOpen className="mx-auto mb-2 h-10 w-10 text-gray-600" />
            <p className="mb-2 text-sm font-medium text-gray-800">
              Vyberte složku s exportem (bez zabalení do ZIP)
            </p>
            <p className="mb-4 text-xs text-gray-500">
              Náhled CSV je rychlý (nahraje se jen products.csv). Při „Spustit import“ se soubory
              nahrávají postupně po dávkách (cca {IML_PRODUCT_IMPORT_BATCH_MAX_MB} MB) – velikost
              složky není omezena.
            </p>
            <input
              ref={folderInputRef}
              type="file"
              // @ts-expect-error webkitdirectory není v typu input
              webkitdirectory=""
              directory=""
              multiple
              onChange={(e) => void handleFolderChange(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading && step === "upload" ? "Načítám náhled…" : "Vybrat složku"}
            </button>
            {(folderFiles?.length || zipFile) && (
              <p className="mt-3 text-sm text-gray-700">
                <strong>{folderLabel || zipFile?.name}</strong>
                <span className="text-gray-500"> · {importSizeLabel}</span>
              </p>
            )}
          </div>
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-300" />
            <span className="text-xs text-gray-500">nebo</span>
            <div className="h-px flex-1 bg-gray-300" />
          </div>
          <div className="text-center">
            <FileArchive className="mx-auto mb-2 h-8 w-8 text-gray-400" />
            <p className="mb-2 text-xs text-gray-600">
              ZIP archiv (volitelně, max. {IML_PRODUCT_IMPORT_MAX_MB} MB)
            </p>
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip"
              onChange={(e) => void handleZipChange(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => zipInputRef.current?.click()}
              disabled={loading}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Vybrat ZIP
            </button>
          </div>
        </div>
      )}

      {(step === "mapping" || step === "conflicts") && headers.length > 0 && (
        <div className="space-y-6">
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <strong>{folderLabel || zipFile?.name}</strong>
            {csvPath && (
              <span className="ml-2 text-blue-700">
                CSV: {csvPath} · {rowCount} řádků
              </span>
            )}
            {fileIndex && (
              <span className="mt-1 block text-xs text-blue-800">
                Soubory v ZIP: {fileIndex.total} celkem ({fileIndex.print} tisk,{" "}
                {fileIndex.preview} náhled
                {fileIndex.unknown > 0 ? `, ${fileIndex.unknown} nerozpoznaných` : ""})
                {fileIndex.unmatchedCodes?.length > 0 && (
                  <span className="ml-1">
                    · kódy bez řádku v CSV: {fileIndex.unmatchedCodes.slice(0, 5).join(", ")}
                    {fileIndex.unmatchedCodes.length > 5 ? "…" : ""}
                  </span>
                )}
              </span>
            )}
          </div>

          {step === "mapping" && (
            <>
              <MappingPanel
                headers={headers}
                rows={rows}
                mapping={mapping}
                dragOver={dragOver}
                draggedCol={draggedCol}
                setDragOver={setDragOver}
                setDraggedCol={setDraggedCol}
                onDropTarget={onDropTarget}
                removeMapping={removeMapping}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCheckConflicts()}
                  disabled={loading || !canCheckConflicts()}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? "Kontroluji…" : "Pokračovat – konflikty"}
                </button>
                <button
                  type="button"
                  onClick={resetImportFlow}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Zrušit
                </button>
              </div>
            </>
          )}

          {step === "conflicts" && (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Konflikty ({conflicts.length}) a výchozí akce
                </h3>
                <p className="mb-4 text-xs text-gray-500">
                  U existujícího kódu IG: přepsat aktualizuje data z CSV; přeskočit ponechá metadata,
                  soubory z ZIP se přiřadí k existujícímu produktu.
                </p>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="text-sm text-gray-700">Výchozí pro konflikty:</span>
                  {(
                    [
                      ["skip", "Přeskočit"],
                      ["overwrite", "Přepsat"],
                    ] as const
                  ).map(([val, label]) => (
                    <label key={val} className="inline-flex items-center gap-1 text-sm">
                      <input
                        type="radio"
                        name="defaultAction"
                        checked={defaultAction === val}
                        onChange={() => setDefaultAction(val)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {conflicts.length === 0 ? (
                  <p className="text-sm text-green-700">
                    Žádný konflikt – všechny kódy z CSV jsou nové.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="px-3 py-2 text-left">Kód IG</th>
                          <th className="px-3 py-2 text-left">CSV název</th>
                          <th className="px-3 py-2 text-left">V DB</th>
                          <th className="px-3 py-2 text-left">Akce</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conflicts.map((c) => (
                          <tr key={c.igCode} className="border-b border-gray-100">
                            <td className="px-3 py-2 font-mono text-xs">{c.igCode}</td>
                            <td className="px-3 py-2">{c.csvName || "—"}</td>
                            <td className="px-3 py-2">
                              {c.existing.client_name ?? "—"} (id {c.existing.id})
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={byCode[c.igCode] ?? defaultAction}
                                onChange={(e) =>
                                  setRowAction(c.igCode, e.target.value as ConflictResolution)
                                }
                                className="rounded border border-gray-300 px-2 py-1 text-sm"
                              >
                                <option value="skip">Přeskočit</option>
                                <option value="overwrite">Přepsat</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleExecute()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {loading ? "Importuji…" : "Spustit import"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("mapping")}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Zpět na mapování
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-10 border-t border-gray-200 pt-6">
        <button
          type="button"
          onClick={() => setShowLegacy(!showLegacy)}
          className="text-sm text-gray-600 underline hover:text-gray-900"
        >
          {showLegacy ? "Skrýt" : "Zobrazit"} import pouze CSV/Excel (bez ZIP)
        </button>
        {showLegacy && (
          <LegacyCsvImport
            csvInputRef={csvInputRef}
            loading={loading}
            legacyResult={legacyResult}
            onImport={handleLegacyCsvImport}
          />
        )}
      </div>
    </>
  );
}

function MappingPanel({
  headers,
  rows,
  mapping,
  dragOver,
  draggedCol,
  setDragOver,
  setDraggedCol,
  onDropTarget,
  removeMapping,
}: {
  headers: string[];
  rows: string[][];
  mapping: Mapping;
  dragOver: string | null;
  draggedCol: number | null;
  setDragOver: (v: string | null) => void;
  setDraggedCol: (v: number | null) => void;
  onDropTarget: (fieldKey: string) => void;
  removeMapping: (fieldKey: string) => void;
}) {
  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Mapování sloupců CSV</h3>
        <p className="mb-4 text-xs text-gray-500">
          Sloupec <code className="rounded bg-gray-100 px-1">code</code> z IMLEXportu se mapuje na
          Kód IG (podporováno <code className="rounded bg-gray-100 px-1">06-02-001</code> i{" "}
          <code className="rounded bg-gray-100 px-1">498056</code>). Povinné: alespoň Kód IG,
          Název u klienta nebo Zkrácený název.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">Sloupce v CSV</p>
            <div className="flex flex-wrap gap-2">
              {headers.map((h, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={() => setDraggedCol(i)}
                  onDragEnd={() => setDraggedCol(null)}
                  className={`flex cursor-grab items-center gap-1 rounded-lg border px-3 py-2 text-sm ${
                    draggedCol === i
                      ? "border-red-400 bg-red-50 opacity-80"
                      : "border-gray-300 bg-white hover:border-gray-400"
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{h}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">Cílová pole</p>
            <div className="max-h-[400px] space-y-2 overflow-y-auto">
              {TARGET_FIELDS.map((f) => (
                <div
                  key={f.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(f.key);
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => onDropTarget(f.key)}
                  className={`flex items-center justify-between rounded-lg border-2 px-3 py-2 ${
                    dragOver === f.key
                      ? "border-red-400 bg-red-50"
                      : mapping[f.key] != null
                        ? "border-green-300 bg-green-50/50"
                        : "border-dashed border-gray-300 bg-gray-50"
                  }`}
                >
                  <span className="text-sm">{f.label}</span>
                  {mapping[f.key] != null ? (
                    <span className="flex items-center gap-1">
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                        {headers[mapping[f.key]]}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMapping(f.key)}
                        className="text-red-600 hover:text-red-700"
                      >
                        ×
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Přetáhněte sloupec</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Náhled dat</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium text-gray-700">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-gray-100">
                  {headers.map((_, ci) => (
                    <td key={ci} className="max-w-[200px] truncate px-3 py-2">
                      {row[ci] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function LegacyCsvImport({
  csvInputRef,
  loading,
  legacyResult,
  onImport,
}: {
  csvInputRef: React.RefObject<HTMLInputElement | null>;
  loading: boolean;
  legacyResult: { imported: number; errors: string[] } | null;
  onImport: (file: File, mapping: Mapping) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-6">
      <FileSpreadsheet className="mb-2 h-8 w-8 text-gray-500" />
      <p className="mb-2 text-sm text-gray-600">CSV nebo Excel bez příloh v archivu</p>
      {legacyResult && (
        <p className="mb-2 text-sm text-green-800">Importováno: {legacyResult.imported}</p>
      )}
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mb-2 block text-sm"
      />
      <p className="text-xs text-gray-500">
        Pro jednoduchý import nastavte mapování na stránce ZIP (stejná pole) – zde stačí soubor s
        hlavičkou obsahující sloupce code, name, contractor.
      </p>
      <button
        type="button"
        disabled={!file || loading}
        onClick={() => {
          if (!file) return;
          const auto: Mapping = {};
          void onImport(file, Object.keys(mapping).length ? mapping : auto);
        }}
        className="mt-2 rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        Importovat CSV
      </button>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Upload, Download, CheckCircle, AlertTriangle, FileText, HelpCircle } from "lucide-react";

type ImportLog = {
  id: number;
  filename: string;
  records_count: number;
  success_count: number | null;
  error_count: number | null;
  errors: string | null;
  created_at: string;
  users: { first_name: string; last_name: string };
};

type RowError = { line: number; message: string };

type SampleRow = { line: number; cells: string[] };

type QuestionField =
  | "category"
  | "question"
  | "option_a"
  | "option_b"
  | "option_c"
  | "option_d"
  | "correct_answer"
  | "difficulty"
  | "explanation"
  | "source";

const QUESTION_FIELD_ORDER: { field: QuestionField; label: string; required: boolean }[] = [
  { field: "category", label: "Kategorie / okruh", required: true },
  { field: "question", label: "Text otázky", required: true },
  { field: "option_a", label: "Možnost A", required: true },
  { field: "option_b", label: "Možnost B", required: true },
  { field: "option_c", label: "Možnost C", required: false },
  { field: "option_d", label: "Možnost D", required: false },
  { field: "correct_answer", label: "Správná odpověď (A–D, i více)", required: true },
  { field: "difficulty", label: "Obtížnost", required: false },
  { field: "explanation", label: "Vysvětlení", required: false },
  { field: "source", label: "Zdroj", required: false },
];

type Analysis = {
  header: string[];
  sampleRows: SampleRow[];
  delimiter: string;
  totalRows: number;
};

type Validation = {
  validRows: number;
  totalRows: number;
  errors: RowError[];
  totalErrors: number;
  resultCount?: number;
  preview: {
    line?: number;
    category?: string | null;
    question?: string;
    correct_answers?: string;
    title?: string;
    contentLength?: number;
  }[];
};

type ImportResult = {
  imported: number;
  totalRows: number;
  errors: RowError[];
  totalErrors: number;
};

const CSV_TEMPLATE = [
  "kategorie;otazka;moznost_a;moznost_b;moznost_c;moznost_d;spravna_odpoved;obtiznost;vysvetleni;zdroj",
  'BEZP;Co je phishing?;Podvodný e-mail vylákávající údaje;Typ antiviru;Šifrovací algoritmus;Síťový protokol;A;snadná;"Phishing je podvodná technika, cílem je vylákat citlivé údaje.";Interní směrnice',
  'BEZP;Které znaky jsou typické pro phishing? (vyberte 2);Časový tlak;Podezřelý odesílatel;Oficiální podpis;Žádné odkazy;"A, B";střední;;',
].join("\r\n");

export function ImportClient() {
  const [importType, setImportType] = useState<"questions" | "materials">("questions");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Mapování otázek: pole → index sloupce (-1 = nemapováno)
  const [qMapping, setQMapping] = useState<Record<QuestionField, number>>(
    Object.fromEntries(QUESTION_FIELD_ORDER.map((f) => [f.field, -1])) as Record<
      QuestionField,
      number
    >
  );
  // Mapování materiálů
  const [mTitle, setMTitle] = useState(-1);
  const [mCategory, setMCategory] = useState(-1);
  const [mSource, setMSource] = useState(-1);
  const [mContent, setMContent] = useState<number[]>([]);
  const [groupBy, setGroupBy] = useState<"row" | "category">("row");

  const [history, setHistory] = useState<ImportLog[]>([]);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  const endpoint =
    importType === "questions" ? "/api/training/import" : "/api/training/materials/import";

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/training/import");
      const data = await res.json();
      if (res.ok) setHistory(data.imports ?? []);
    } catch {
      // historie není kritická
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const buildMappingPayload = useCallback(() => {
    if (importType === "questions") {
      const mapping: Record<string, number | null> = {};
      for (const { field } of QUESTION_FIELD_ORDER) {
        mapping[field] = qMapping[field] >= 0 ? qMapping[field] : null;
      }
      return mapping;
    }
    return {
      title: mTitle >= 0 ? mTitle : null,
      category: mCategory >= 0 ? mCategory : null,
      source: mSource >= 0 ? mSource : null,
      content: mContent,
    };
  }, [importType, qMapping, mTitle, mCategory, mSource, mContent]);

  const send = useCallback(
    async (mode: "analyze" | "validate" | "import", selectedFile?: File) => {
      const target = selectedFile ?? file;
      if (!target) return;
      setBusy(true);
      setError("");
      if (mode === "import") setImportResult(null);

      try {
        const formData = new FormData();
        formData.append("file", target);
        formData.append("mode", mode);
        if (mode !== "analyze") {
          formData.append("mapping", JSON.stringify(buildMappingPayload()));
        }
        if (importType === "materials") {
          formData.append("group_by", groupBy);
        }

        const res = await fetch(endpoint, { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Chyba při zpracování souboru");

        if (mode === "analyze") {
          setAnalysis({
            header: data.header ?? [],
            sampleRows: data.sampleRows ?? [],
            delimiter: data.delimiter ?? ";",
            totalRows: data.totalRows ?? 0,
          });
          // Převzetí auto-návrhu mapování ze serveru
          if (importType === "questions") {
            const next = Object.fromEntries(
              QUESTION_FIELD_ORDER.map((f) => [
                f.field,
                typeof data.mapping?.[f.field] === "number" ? data.mapping[f.field] : -1,
              ])
            ) as Record<QuestionField, number>;
            setQMapping(next);
          } else {
            setMTitle(typeof data.mapping?.title === "number" ? data.mapping.title : -1);
            setMCategory(typeof data.mapping?.category === "number" ? data.mapping.category : -1);
            setMSource(typeof data.mapping?.source === "number" ? data.mapping.source : -1);
            setMContent(Array.isArray(data.mapping?.content) ? data.mapping.content : []);
          }
          setValidation({
            validRows: data.validRows ?? 0,
            totalRows: data.totalRows ?? 0,
            errors: data.errors ?? [],
            totalErrors: data.totalErrors ?? 0,
            resultCount: data.resultCount,
            preview: data.preview ?? [],
          });
        } else if (mode === "validate") {
          setValidation({
            validRows: data.validRows ?? 0,
            totalRows: data.totalRows ?? 0,
            errors: data.errors ?? [],
            totalErrors: data.totalErrors ?? 0,
            resultCount: data.resultCount,
            preview: data.preview ?? [],
          });
        } else {
          setImportResult({
            imported: data.imported ?? 0,
            totalRows: data.totalRows ?? 0,
            errors: data.errors ?? [],
            totalErrors: data.totalErrors ?? 0,
          });
          setValidation(null);
          setAnalysis(null);
          setFile(null);
          await loadHistory();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chyba při zpracování souboru");
      } finally {
        setBusy(false);
      }
    },
    [file, endpoint, importType, groupBy, buildMappingPayload, loadHistory]
  );

  const onFileChange = (f: File | null) => {
    setFile(f);
    setAnalysis(null);
    setValidation(null);
    setImportResult(null);
    if (f) send("analyze", f);
  };

  const onTypeChange = (type: "questions" | "materials") => {
    setImportType(type);
    setFile(null);
    setAnalysis(null);
    setValidation(null);
    setImportResult(null);
    setError("");
  };

  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sablona-otazky.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseLogErrors = (raw: string | null): RowError[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const columnOptions = (analysis?.header ?? []).map((name, idx) => ({
    idx,
    label: `${idx + 1}. ${name || "(bez názvu)"}`,
  }));

  const toggleContentColumn = (idx: number) => {
    setMContent((prev) =>
      prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const canImport =
    validation !== null &&
    validation.validRows > 0 &&
    (importType === "questions"
      ? QUESTION_FIELD_ORDER.filter((f) => f.required).every((f) => qMapping[f.field] >= 0)
      : mTitle >= 0 && mContent.length > 0);

  return (
    <>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Upload className="h-7 w-7 text-red-600" />
          Import z CSV
        </h1>
        <p className="mt-1 text-gray-600">
          Hromadné nahrání otázek nebo výukových materiálů s mapováním sloupců.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-semibold text-gray-900">1. Co importujete</h2>
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => onTypeChange("questions")}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                  importType === "questions"
                    ? "bg-red-600 text-white"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <HelpCircle className="h-4 w-4" />
                Otázky
              </button>
              <button
                type="button"
                onClick={() => onTypeChange("materials")}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                  importType === "materials"
                    ? "bg-red-600 text-white"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <FileText className="h-4 w-4" />
                Výukové materiály
              </button>
            </div>

            {importType === "questions" && (
              <button
                type="button"
                onClick={downloadTemplate}
                className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Stáhnout šablonu otázek
              </button>
            )}

            <input
              key={importType}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-red-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-red-700"
            />
            <p className="mt-2 text-xs text-gray-500">
              Oddělovač (čárka/středník) i sloupce se rozpoznají automaticky – mapování níže
              můžete ručně upravit.
            </p>
          </div>

          {analysis && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 font-semibold text-gray-900">
                2. Mapování sloupců
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({analysis.totalRows} řádků, oddělovač „{analysis.delimiter}“)
                </span>
              </h2>

              {importType === "questions" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {QUESTION_FIELD_ORDER.map(({ field, label, required }) => (
                    <div key={field}>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {label} {required && "*"}
                      </label>
                      <select
                        value={qMapping[field]}
                        onChange={(e) =>
                          setQMapping((prev) => ({
                            ...prev,
                            [field]: parseInt(e.target.value, 10),
                          }))
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm ${
                          required && qMapping[field] < 0
                            ? "border-red-300 bg-red-50"
                            : "border-gray-300"
                        }`}
                      >
                        <option value={-1}>– nemapováno –</option>
                        {columnOptions.map((c) => (
                          <option key={c.idx} value={c.idx}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Název / téma *
                      </label>
                      <select
                        value={mTitle}
                        onChange={(e) => setMTitle(parseInt(e.target.value, 10))}
                        className={`w-full rounded-lg border px-3 py-2 text-sm ${
                          mTitle < 0 ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                      >
                        <option value={-1}>– nemapováno –</option>
                        {columnOptions.map((c) => (
                          <option key={c.idx} value={c.idx}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Kategorie / okruh
                      </label>
                      <select
                        value={mCategory}
                        onChange={(e) => setMCategory(parseInt(e.target.value, 10))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value={-1}>– nemapováno –</option>
                        {columnOptions.map((c) => (
                          <option key={c.idx} value={c.idx}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Zdroj</label>
                      <select
                        value={mSource}
                        onChange={(e) => setMSource(parseInt(e.target.value, 10))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value={-1}>– nemapováno –</option>
                        {columnOptions.map((c) => (
                          <option key={c.idx} value={c.idx}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Sloupce s obsahem * (spojí se do textu materiálu)
                    </label>
                    <div className="flex flex-wrap gap-2 rounded-lg border border-gray-300 p-3">
                      {columnOptions.map((c) => (
                        <label key={c.idx} className="inline-flex items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            checked={mContent.includes(c.idx)}
                            onChange={() => toggleContentColumn(c.idx)}
                            className="h-4 w-4"
                          />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Seskupení řádků
                    </label>
                    <div className="flex gap-4 text-sm text-gray-700">
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={groupBy === "row"}
                          onChange={() => setGroupBy("row")}
                          className="h-4 w-4"
                        />
                        Každý řádek = samostatný materiál
                      </label>
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={groupBy === "category"}
                          onChange={() => setGroupBy("category")}
                          className="h-4 w-4"
                        />
                        Sloučit řádky stejného okruhu do jednoho materiálu
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-2 py-1.5 font-medium">ř.</th>
                      {analysis.header.map((h, i) => (
                        <th key={i} className="max-w-40 truncate px-2 py-1.5 font-medium">
                          {i + 1}. {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {analysis.sampleRows.map((row) => (
                      <tr key={row.line}>
                        <td className="px-2 py-1.5 text-gray-400">{row.line}</td>
                        {row.cells.map((cell, i) => (
                          <td key={i} className="max-w-40 truncate px-2 py-1.5 text-gray-700">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => send("validate")}
                  disabled={!file || busy}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {busy ? "Zpracovávám…" : "Zkontrolovat s tímto mapováním"}
                </button>
                <button
                  type="button"
                  onClick={() => send("import")}
                  disabled={!canImport || busy}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {busy ? "Importuji…" : "Importovat"}
                </button>
              </div>
            </div>
          )}

          {validation && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 font-semibold text-gray-900">3. Výsledek kontroly</h2>
              <p className="text-sm text-gray-700">
                {validation.validRows} z {validation.totalRows} řádků je v pořádku.
                {importType === "materials" &&
                  validation.resultCount !== undefined &&
                  ` Vznikne ${validation.resultCount} materiálů.`}
              </p>
              {validation.errors.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-red-700">
                  {validation.errors.slice(0, 20).map((e, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {e.line > 0 ? `Řádek ${e.line}: ` : ""}
                      {e.message}
                    </li>
                  ))}
                  {validation.totalErrors > 20 && (
                    <li className="text-gray-500">… a dalších {validation.totalErrors - 20} chyb</li>
                  )}
                </ul>
              )}
              {validation.preview.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm text-gray-600">
                  {validation.preview.map((row, i) => (
                    <p key={i} className="truncate">
                      {importType === "questions" ? (
                        <>
                          <span className="font-medium text-gray-400">ř. {row.line}:</span>{" "}
                          [{row.category}] {row.question}{" "}
                          <span className="text-gray-400">(správně {row.correct_answers})</span>
                        </>
                      ) : (
                        <>
                          {row.category && <span className="text-gray-400">[{row.category}] </span>}
                          {row.title}{" "}
                          <span className="text-gray-400">({row.contentLength} znaků)</span>
                        </>
                      )}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {importResult && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6">
              <p className="flex items-center gap-2 font-medium text-green-800">
                <CheckCircle className="h-5 w-5" />
                Import dokončen: {importResult.imported}{" "}
                {importType === "questions" ? "otázek" : "materiálů"}
                {importType === "questions" && ` z ${importResult.totalRows} řádků`}
              </p>
              {importResult.totalErrors > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-amber-800">
                    {importResult.totalErrors} chyb:
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-amber-800">
                    {importResult.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>
                        {e.line > 0 ? `Řádek ${e.line}: ` : ""}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h2 className="font-semibold text-gray-900">Historie importů otázek</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {history.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">Zatím žádné importy</div>
            ) : (
              history.map((log) => {
                const logErrors = parseLogErrors(log.errors);
                return (
                  <div key={log.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{log.filename}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleString("cs-CZ")} |{" "}
                          {log.users.first_name} {log.users.last_name} | {log.success_count ?? 0}/
                          {log.records_count} úspěšně
                          {(log.error_count ?? 0) > 0 && `, ${log.error_count} chyb`}
                        </p>
                      </div>
                      {logErrors.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedLog((prev) => (prev === log.id ? null : log.id))
                          }
                          className="shrink-0 text-sm text-red-600 hover:underline"
                        >
                          {expandedLog === log.id ? "Skrýt chyby" : "Chyby"}
                        </button>
                      )}
                    </div>
                    {expandedLog === log.id && logErrors.length > 0 && (
                      <ul className="mt-2 space-y-0.5 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                        {logErrors.slice(0, 30).map((e, i) => (
                          <li key={i}>
                            Řádek {e.line}: {e.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}

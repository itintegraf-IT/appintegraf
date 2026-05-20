"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Download,
  Upload,
  AlertTriangle,
  Loader2,
  Server,
  FileArchive,
} from "lucide-react";
import { BACKUP_MODULE_IDS, type BackupManifest, type BackupModuleId } from "@/lib/backup/types";
import { BACKUP_MODULES } from "@/lib/backup/module-registry";

const CONFIRM_TEXT = "OBNOVIT";
const MAX_UPLOAD_MB = 60;

type ServerBackupFile = { name: string; size: number; mtime: string };

export function BackupRestorePanel() {
  const [selected, setSelected] = useState<Set<BackupModuleId>>(
    () => new Set(BACKUP_MODULE_IDS)
  );
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState("");
  const [manifest, setManifest] = useState<BackupManifest | null>(null);

  const [serverFiles, setServerFiles] = useState<ServerBackupFile[]>([]);
  const [backupDir, setBackupDir] = useState("");
  const [serverFileName, setServerFileName] = useState("");

  const moduleList = useMemo(
    () =>
      BACKUP_MODULE_IDS.map((id) => ({
        id,
        label: BACKUP_MODULES[id].label,
        description: BACKUP_MODULES[id].description,
        dependsOn: BACKUP_MODULES[id].dependsOn,
      })),
    []
  );

  const warnings = useMemo(() => {
    const w: string[] = [];
    for (const m of moduleList) {
      for (const dep of m.dependsOn ?? []) {
        if (!selected.has(dep)) {
          w.push(`„${m.label}“ obvykle vyžaduje také „${BACKUP_MODULES[dep].label}“.`);
        }
      }
    }
    if (selected.has("vyroba")) {
      w.push("Modul Výroba nezálohuje soubory na síťové cestě VYROBA_OUTPUT_PATH.");
    }
    return w;
  }, [selected, moduleList]);

  const loadServerFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/backup/files");
      if (!res.ok) return;
      const data = (await res.json()) as { files: ServerBackupFile[]; backupDir: string };
      setServerFiles(data.files ?? []);
      setBackupDir(data.backupDir ?? "");
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    void loadServerFiles();
  }, [loadServerFiles]);

  const toggleModule = (id: BackupModuleId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (on: boolean) => {
    setSelected(on ? new Set(BACKUP_MODULE_IDS) : new Set());
  };

  const modulesArray = () => [...selected];

  const handleExport = async () => {
    setError(null);
    setSuccess(null);
    if (selected.size === 0) {
      setError("Vyberte alespoň jeden modul.");
      return;
    }
    setExporting(true);
    try {
      const res = await fetch("/api/admin/backup/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules: modulesArray() }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? "Export selhal");
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disp);
      const filename = match?.[1] ?? "integraf-backup.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess("Záloha byla stažena.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export selhal");
    } finally {
      setExporting(false);
    }
  };

  const inspectZip = async (file: File | null, serverName?: string) => {
    setError(null);
    setManifest(null);
    setInspecting(true);
    try {
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        res = await fetch("/api/admin/backup/inspect", { method: "POST", body: fd });
      } else if (serverName) {
        res = await fetch("/api/admin/backup/inspect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: serverName }),
        });
      } else {
        return;
      }
      const data = (await res.json()) as { manifest?: BackupManifest; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Načtení manifestu selhalo");
      setManifest(data.manifest ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inspect selhal");
    } finally {
      setInspecting(false);
    }
  };

  const runImport = async (mode: "upload" | "server") => {
    setError(null);
    setSuccess(null);
    if (confirm !== CONFIRM_TEXT) {
      setError(`Pro obnovu zadejte přesně „${CONFIRM_TEXT}“.`);
      return;
    }
    if (selected.size === 0) {
      setError("Vyberte moduly k obnově.");
      return;
    }
    setImporting(true);
    try {
      let res: Response;
      if (mode === "upload") {
        if (!uploadFile) throw new Error("Vyberte soubor zálohy.");
        if (uploadFile.size > MAX_UPLOAD_MB * 1024 * 1024) {
          throw new Error(`Soubor je větší než ${MAX_UPLOAD_MB} MB – použijte obnovu ze serveru.`);
        }
        const fd = new FormData();
        fd.append("file", uploadFile);
        fd.append("confirm", confirm);
        fd.append("modules", JSON.stringify(modulesArray()));
        res = await fetch("/api/admin/backup/import", { method: "POST", body: fd });
      } else {
        if (!serverFileName) throw new Error("Vyberte soubor na serveru.");
        res = await fetch("/api/admin/backup/import-from-path", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: serverFileName,
            confirm,
            modules: modulesArray(),
          }),
        });
      }
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        errors?: string[];
        modulesRestored?: string[];
        tablesImported?: { name: string; rowCount: number }[];
      };
      if (!res.ok) throw new Error(data.error ?? data.errors?.join("; ") ?? "Obnova selhala");
      const tables = data.tablesImported?.length ?? 0;
      setSuccess(
        `Obnova dokončena. Moduly: ${(data.modulesRestored ?? []).join(", ")}. Tabulky: ${tables}.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Obnova selhala");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Archive className="h-5 w-5 text-red-600" />
          Moduly zálohy
        </h2>
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => selectAll(true)}
            className="rounded border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Vybrat vše
          </button>
          <button
            type="button"
            onClick={() => selectAll(false)}
            className="rounded border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Zrušit výběr
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {moduleList.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-100 p-3 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggleModule(m.id)}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-gray-900">{m.label}</span>
                {m.description && (
                  <span className="mt-0.5 block text-xs text-gray-500">{m.description}</span>
                )}
              </span>
            </label>
          ))}
        </div>
        {warnings.length > 0 && (
          <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <ul className="list-inside list-disc space-y-1">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Download className="h-5 w-5 text-red-600" />
          Export zálohy
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          Stáhne ZIP archiv včetně dat z databáze, nahraných souborů a IML PDF/obrázků.
        </p>
        <button
          type="button"
          disabled={exporting || selected.size === 0}
          onClick={() => void handleExport()}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? "Exportuji…" : "Stáhnout zálohu"}
        </button>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Upload className="h-5 w-5 text-red-600" />
          Obnova dat
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          Režim <strong>nahradit</strong>: data vybraných modulů budou smazána a nahrazena obsahem
          zálohy. Heslo uživatelů zůstane; 2FA TOTP je po obnově nutné znovu nastavit.
        </p>

        <div className="mb-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Soubor zálohy (max. {MAX_UPLOAD_MB} MB)
            </label>
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setUploadFile(f);
                setManifest(null);
                if (f) void inspectZip(f);
              }}
              className="block w-full text-sm"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Server className="h-4 w-4" />
              Obnova ze serveru ({backupDir || "BACKUP_DIR"})
            </h3>
            <p className="mb-2 text-xs text-gray-500">
              Pro zálohy větší než {MAX_UPLOAD_MB} MB zkopírujte ZIP do složky na serveru.
            </p>
            <select
              value={serverFileName}
              onChange={(e) => {
                setServerFileName(e.target.value);
                setManifest(null);
                if (e.target.value) void inspectZip(null, e.target.value);
              }}
              className="mb-2 w-full max-w-md rounded border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">— vyberte soubor —</option>
              {serverFiles.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadServerFiles()}
              className="text-sm text-red-600 hover:underline"
            >
              Obnovit seznam
            </button>
          </div>

          {inspecting && (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Načítám manifest…
            </p>
          )}

          {manifest && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-gray-900">
                <FileArchive className="h-4 w-4" />
                Obsah zálohy
              </p>
              <p className="mt-1 text-gray-600">
                Vytvořeno: {new Date(manifest.createdAt).toLocaleString("cs-CZ")} · verze{" "}
                {manifest.appVersion}
              </p>
              <p className="text-gray-600">Moduly: {manifest.modules.join(", ")}</p>
              <p className="mt-1 text-gray-600">
                Tabulky: {manifest.tables.map((t) => `${t.name} (${t.rowCount})`).join(", ")}
              </p>
              {manifest.warnings?.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-amber-800">
                  {manifest.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Potvrzení (napište {CONFIRM_TEXT})
            </label>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full max-w-xs rounded border border-gray-200 px-3 py-2 text-sm"
              placeholder={CONFIRM_TEXT}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={importing || !uploadFile}
              onClick={() => void runImport("upload")}
              className="inline-flex items-center gap-2 rounded-lg border border-red-600 px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Obnovit z uploadu
            </button>
            <button
              type="button"
              disabled={importing || !serverFileName}
              onClick={() => void runImport("server")}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
              Obnovit ze serveru
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { maketyFileKindLabel } from "@/lib/makety-file-kind";

export type SoftproofFileOption = {
  id: number;
  original_filename: string;
  document_type: string | null;
  file_size: number;
};

type Props = {
  open: boolean;
  files: SoftproofFileOption[];
  defaultEmail: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    fileId: number;
    toEmail: string;
    attachFile: boolean;
    message: string;
  }) => void;
};

export function SoftproofSendConfirmDialog({
  open,
  files,
  defaultEmail,
  submitting,
  onClose,
  onConfirm,
}: Props) {
  const softproofFiles = useMemo(
    () => files.filter((f) => f.document_type === "softproof"),
    [files]
  );

  const [fileId, setFileId] = useState<number | "">("");
  const [clientEmail, setClientEmail] = useState(defaultEmail);
  const [attachFile, setAttachFile] = useState(false);
  const [message, setMessage] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setClientEmail(defaultEmail);
    setAttachFile(false);
    setMessage("");
    setLocalError(null);
    setFileId(softproofFiles.length === 1 ? softproofFiles[0]!.id : "");
  }, [open, defaultEmail, softproofFiles]);

  if (!open) return null;

  const selected = softproofFiles.find((f) => f.id === fileId);

  const submit = () => {
    if (!fileId) {
      setLocalError("Vyberte softproof soubor");
      return;
    }
    if (!clientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
      setLocalError("Zadejte platný e-mail klienta");
      return;
    }
    setLocalError(null);
    onConfirm({
      fileId: Number(fileId),
      toEmail: clientEmail.trim(),
      attachFile,
      message: message.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="softproof-dialog-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
        <h2 id="softproof-dialog-title" className="text-lg font-semibold text-gray-900">
          Kontrola před odesláním klientovi
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Klientovi vždy odchází jen <strong>softproof (náhled)</strong>. Zkontrolujte soubor a
          e-mail, případně doplňte doprovodný text.
        </p>

        {softproofFiles.length === 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Nejdřív nahrajte soubor a nastavte mu typ <strong>Softproof (náhled)</strong> v
            Dokumentaci.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Softproof soubor <span className="text-red-600">*</span>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={fileId === "" ? "" : String(fileId)}
                onChange={(e) => setFileId(e.target.value ? Number(e.target.value) : "")}
                disabled={submitting}
              >
                <option value="">— vyberte —</option>
                {softproofFiles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.original_filename} ({Math.round(f.file_size / 1024)} kB)
                  </option>
                ))}
              </select>
            </label>

            {selected && (
              <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-950">
                <div>
                  <span className="font-medium">Soubor:</span> {selected.original_filename}
                </div>
                <div>
                  <span className="font-medium">Typ:</span>{" "}
                  {maketyFileKindLabel(selected.document_type)}
                </div>
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700">
              E-mail klienta <span className="text-red-600">*</span>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                disabled={submitting}
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Doprovodný text (volitelné)
              <textarea
                rows={4}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Text, který klient uvidí v e-mailu…"
                disabled={submitting}
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={attachFile}
                onChange={(e) => setAttachFile(e.target.checked)}
                disabled={submitting}
              />
              Přiložit soubor k e-mailu (max 8 MB), jinak jen odkaz
            </label>
          </div>
        )}

        {localError && <p className="mt-3 text-sm text-red-600">{localError}</p>}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || softproofFiles.length === 0}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? "Odesílám…" : "Potvrdit odeslání"}
          </button>
        </div>
      </div>
    </div>
  );
}

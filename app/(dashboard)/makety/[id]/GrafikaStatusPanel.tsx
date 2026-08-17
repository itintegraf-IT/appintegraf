"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  grafikaTransitionButtonClass,
  type GrafikaStatus,
} from "@/lib/makety-grafika-status";
import {
  SoftproofSendConfirmDialog,
  type SoftproofFileOption,
} from "./SoftproofSendConfirmDialog";

type TransitionOption = {
  toStatus: GrafikaStatus;
  label: string;
  requiresComment: boolean;
  requiresOverrideAck?: boolean;
  actingAs?: string;
};

type Props = {
  maketaId: number;
  initialStatus: string;
  /** Výchozí e-mail klienta (IML) pro softproof. */
  defaultClientEmail?: string | null;
};

export function GrafikaStatusPanel({
  maketaId,
  initialStatus,
  defaultClientEmail = null,
}: Props) {
  const router = useRouter();
  const [transitions, setTransitions] = useState<TransitionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<GrafikaStatus | null>(null);
  const [selected, setSelected] = useState<GrafikaStatus | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [overrideAck, setOverrideAck] = useState(false);

  const [files, setFiles] = useState<SoftproofFileOption[]>([]);
  const [skipEmail, setSkipEmail] = useState(false);
  const [softproofDialogOpen, setSoftproofDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/makety/${maketaId}/transition`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.transitions)) {
        setTransitions(data.transitions);
      } else {
        setTransitions([]);
      }
    } catch {
      setTransitions([]);
    }
    setLoading(false);
  }, [maketaId]);

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/makety/${maketaId}/files`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.files)) {
        setFiles(
          data.files.map(
            (f: {
              id: number;
              original_filename: string;
              document_type: string | null;
              file_size: number;
            }) => ({
              id: f.id,
              original_filename: f.original_filename,
              document_type: f.document_type,
              file_size: f.file_size,
            })
          )
        );
      }
    } catch {
      /* ignore */
    }
  }, [maketaId]);

  useEffect(() => {
    void load();
  }, [load, initialStatus]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const selectedTransition = transitions.find((t) => t.toStatus === selected);
  const needsSoftproof = selected === "sent_for_approval";
  const needsOverrideAck = selectedTransition?.requiresOverrideAck === true;

  const resetAfterSuccess = async () => {
    setSelected(null);
    setComment("");
    setSkipEmail(false);
    setOverrideAck(false);
    setSoftproofDialogOpen(false);
    router.refresh();
    await load();
    await loadFiles();
  };

  const runTransition = async () => {
    if (!selected) return;
    if (needsOverrideAck && !overrideAck) {
      setError("Potvrďte, že víte, že přebíráte cizí roli ve workflow.");
      return;
    }
    setError(null);
    setSubmitting(selected);

    try {
      const res = await fetch(`/api/makety/${maketaId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus: selected,
          comment:
            selected === "sent_for_approval" && skipEmail
              ? comment.trim() || "Odesláno ke schválení bez e-mailu softproofu"
              : comment.trim() || undefined,
          acknowledgeOverride: needsOverrideAck || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Přechod se nezdařil");
        setSubmitting(null);
        return;
      }
      await resetAfterSuccess();
    } catch {
      setError("Síťová chyba");
    }
    setSubmitting(null);
  };

  const onPrimaryClick = () => {
    if (!selected) return;
    if (needsOverrideAck && !overrideAck) {
      setError("Potvrďte, že víte, že přebíráte cizí roli ve workflow.");
      return;
    }
    if (needsSoftproof && !skipEmail) {
      setError(null);
      void loadFiles().then(() => setSoftproofDialogOpen(true));
      return;
    }
    void runTransition();
  };

  const onSoftproofConfirm = async (payload: {
    fileId: number;
    toEmail: string;
    attachFile: boolean;
    message: string;
    locale: string;
  }) => {
    if (needsOverrideAck && !overrideAck) {
      setError("Potvrďte, že víte, že přebíráte cizí roli ve workflow.");
      return;
    }
    setError(null);
    setSubmitting("sent_for_approval");
    try {
      const res = await fetch(`/api/makety/${maketaId}/send-softproof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: payload.fileId,
          toEmail: payload.toEmail,
          attachFile: payload.attachFile,
          message: payload.message || undefined,
          locale: payload.locale,
          acknowledgeOverride: needsOverrideAck || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Odeslání softproofu selhalo");
        setSubmitting(null);
        return;
      }
      await resetAfterSuccess();
    } catch {
      setError("Síťová chyba");
    }
    setSubmitting(null);
  };

  if (loading) {
    return (
      <div className="w-full max-w-xs rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 sm:w-72">
        Načítám workflow…
      </div>
    );
  }

  if (transitions.length === 0) {
    return null;
  }

  return (
    <>
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-gray-50 p-3 sm:w-80">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          Workflow grafiky
        </h3>

        {error && (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
            {error}
          </div>
        )}

        <div className="mt-2 flex flex-col gap-1.5">
          {transitions.map((t) => (
            <button
              key={t.toStatus}
              type="button"
              onClick={() => {
                setSelected(t.toStatus);
                setError(null);
                setOverrideAck(false);
                setSkipEmail(false);
                setSoftproofDialogOpen(false);
                if (!t.requiresComment) setComment("");
              }}
              className={`w-full text-left ${grafikaTransitionButtonClass(
                t.toStatus,
                selected === t.toStatus
              )}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {selected && selectedTransition?.requiresComment && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-gray-700">
              {selected === "in_progress" ? "Důvod vrácení grafikovi" : "Popis problému"}{" "}
              <span className="text-red-600">*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              placeholder={
                selected === "in_progress"
                  ? "Popište, co má grafik upravit…"
                  : "Popište problém s daty…"
              }
            />
          </div>
        )}

        {needsOverrideAck && selected && (
          <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-950">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={overrideAck}
              onChange={(e) => {
                setOverrideAck(e.target.checked);
                setError(null);
              }}
              disabled={submitting != null}
            />
            <span>
              Vím, co dělám — přebírám roli kompetentní osoby ve workflow
              {selectedTransition?.actingAs ? ` (${selectedTransition.actingAs})` : ""}.
              Normálně by tuto akci měl udělat přiřazený člověk.
            </span>
          </label>
        )}

        {needsSoftproof && (
          <div className="mt-3 space-y-2 rounded-lg border border-blue-200 bg-blue-50/60 p-2.5">
            <label className="flex items-start gap-2 text-xs text-blue-950">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={skipEmail}
                onChange={(e) => {
                  setSkipEmail(e.target.checked);
                  setError(null);
                }}
                disabled={submitting != null}
              />
              <span>
                Bez e-mailu klientovi — jen přepnout stav (softproof pošlete jinak / později)
              </span>
            </label>
            {!skipEmail && (
              <p className="text-xs text-blue-900">
                Po potvrzení se otevře kontrolní okno: výběr softproofu, e-mail a volitelný
                doprovodný text.
              </p>
            )}
          </div>
        )}

        {selected && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPrimaryClick}
              disabled={
                submitting != null ||
                (selectedTransition?.requiresComment === true && !comment.trim()) ||
                (needsOverrideAck && !overrideAck)
              }
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting
                ? needsSoftproof && !skipEmail
                  ? "Odesílám softproof…"
                  : "Ukládám…"
                : needsSoftproof && !skipEmail
                  ? "Pokračovat k odeslání softproofu…"
                  : "Potvrdit"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setComment("");
                setSkipEmail(false);
                setOverrideAck(false);
                setSoftproofDialogOpen(false);
                setError(null);
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-white"
            >
              Zrušit
            </button>
          </div>
        )}
      </div>

      <SoftproofSendConfirmDialog
        open={softproofDialogOpen}
        files={files}
        defaultEmail={defaultClientEmail ?? ""}
        submitting={submitting === "sent_for_approval"}
        onClose={() => setSoftproofDialogOpen(false)}
        onConfirm={(payload) => void onSoftproofConfirm(payload)}
      />
    </>
  );
}

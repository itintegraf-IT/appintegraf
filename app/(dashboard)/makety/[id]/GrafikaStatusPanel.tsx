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

export type SoftproofResendPrefill = {
  toEmail: string | null;
  fileId: number | null;
  locale: string | null;
};

type Props = {
  maketaId: number;
  initialStatus: string;
  /** Výchozí e-mail klienta (IML) pro softproof. */
  defaultClientEmail?: string | null;
  /** Finální schvalovatel / override — smí znovu odeslat softproof ve sent_for_approval. */
  canResendSoftproof?: boolean;
  /** Odesílání softproofu přes override (zadavatel/admin). */
  softproofViaOverride?: boolean;
  /** Předvyplnění z posledního softproof odkazu. */
  lastSoftproofPrefill?: SoftproofResendPrefill | null;
};

export function GrafikaStatusPanel({
  maketaId,
  initialStatus,
  defaultClientEmail = null,
  canResendSoftproof = false,
  softproofViaOverride = false,
  lastSoftproofPrefill = null,
}: Props) {
  const router = useRouter();
  const [transitions, setTransitions] = useState<TransitionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<GrafikaStatus | null>(null);
  const [selected, setSelected] = useState<GrafikaStatus | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [overrideAck, setOverrideAck] = useState(false);
  const [emailClient, setEmailClient] = useState(false);

  const [files, setFiles] = useState<SoftproofFileOption[]>([]);
  const [skipEmail, setSkipEmail] = useState(false);
  const [softproofDialogOpen, setSoftproofDialogOpen] = useState(false);
  const [resendMode, setResendMode] = useState(false);
  const [resendOverrideAck, setResendOverrideAck] = useState(false);

  const showResend =
    canResendSoftproof && initialStatus === "sent_for_approval";

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
    setEmailClient(false);
    setSoftproofDialogOpen(false);
    setResendMode(false);
    setResendOverrideAck(false);
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
          emailClient: selected === "data_problem" && emailClient ? true : undefined,
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
      setResendMode(false);
      void loadFiles().then(() => setSoftproofDialogOpen(true));
      return;
    }
    void runTransition();
  };

  const openResendSoftproof = () => {
    if (softproofViaOverride && !resendOverrideAck) {
      setError(
        "Potvrďte, že víte, že přebíráte roli finálního schvalovatele (odeslání softproofu)."
      );
      return;
    }
    setError(null);
    setResendMode(true);
    void loadFiles().then(() => setSoftproofDialogOpen(true));
  };

  const onSoftproofConfirm = async (payload: {
    fileId: number;
    toEmail: string;
    attachFile: boolean;
    message: string;
    locale: string;
  }) => {
    const needAck =
      (!resendMode && needsOverrideAck) || (resendMode && softproofViaOverride);
    const ackOk = resendMode ? resendOverrideAck : overrideAck;
    if (needAck && !ackOk) {
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
          acknowledgeOverride: needAck || undefined,
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

  if (transitions.length === 0 && !showResend) {
    return null;
  }

  const dialogDefaultEmail =
    (resendMode && lastSoftproofPrefill?.toEmail?.trim()) ||
    defaultClientEmail ||
    "";

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

        {transitions.length > 0 && (
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
                  setResendMode(false);
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
        )}

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

        {selected === "data_problem" && (
          <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={emailClient}
              onChange={(e) => setEmailClient(e.target.checked)}
              disabled={submitting != null}
            />
            <span>
              Odeslat důvod klientovi
              {defaultClientEmail ? ` (${defaultClientEmail})` : " (doplňte e-mail u zákazníka v IML)"}
            </span>
          </label>
        )}

        {needsOverrideAck && selected && (
          <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
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
          <div className="mt-3 space-y-2 rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 dark:border-blue-800 dark:bg-blue-950/40">
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
                setResendMode(false);
                setError(null);
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-white"
            >
              Zrušit
            </button>
          </div>
        )}

        {showResend && (
          <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
            {softproofViaOverride && (
              <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={resendOverrideAck}
                  onChange={(e) => {
                    setResendOverrideAck(e.target.checked);
                    setError(null);
                  }}
                  disabled={submitting != null}
                />
                <span>
                  Vím, co dělám — přebírám roli finálního schvalovatele (znovu
                  odeslání softproofu).
                </span>
              </label>
            )}
            <button
              type="button"
              onClick={openResendSoftproof}
              disabled={
                submitting != null ||
                (softproofViaOverride && !resendOverrideAck)
              }
              className="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-950 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-100 dark:hover:bg-blue-900/60"
            >
              {submitting === "sent_for_approval" && resendMode
                ? "Odesílám softproof…"
                : "Znovu odeslat softproof klientovi"}
            </button>
            <p className="text-[11px] text-gray-600 dark:text-gray-400">
              Vytvoří nový 7denní odkaz a pošle e-mail. Starý odkaz přestane
              platit.
            </p>
          </div>
        )}
      </div>

      <SoftproofSendConfirmDialog
        open={softproofDialogOpen}
        files={files}
        defaultEmail={dialogDefaultEmail}
        initialFileId={resendMode ? lastSoftproofPrefill?.fileId : null}
        initialLocale={resendMode ? lastSoftproofPrefill?.locale : null}
        title={
          resendMode
            ? "Znovu odeslat softproof klientovi"
            : "Kontrola před odesláním klientovi"
        }
        submitting={submitting === "sent_for_approval"}
        onClose={() => {
          setSoftproofDialogOpen(false);
          setResendMode(false);
        }}
        onConfirm={(payload) => void onSoftproofConfirm(payload)}
      />
    </>
  );
}

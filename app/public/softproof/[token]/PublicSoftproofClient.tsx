"use client";

import { useEffect, useState } from "react";
import {
  getSoftproofPublicChrome,
  type SoftproofPublicChrome,
} from "@/lib/makety-softproof-templates";

type Texts = SoftproofPublicChrome & {
  pageTitle: string;
  pageHint: string;
  downloadLabel: string;
  approveLabel: string;
  rejectLabel: string;
  rejectReasonLabel: string;
  legalHtml: string;
};

type MetaOk = {
  status: "ok";
  locale: string;
  fileName: string;
  mime: string;
  canPreview: boolean;
  labelCode: string | null;
  orderNumber: string | null;
  maketaId: number;
  texts: Texts;
};

function applyHtmlLang(locale: string | null | undefined) {
  const lang = (locale ?? "cs").split("-")[0] || "cs";
  document.documentElement.lang = lang;
}

export function PublicSoftproofClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<MetaOk | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [submitting, setSubmitting] = useState<"approved" | "rejected" | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);
  const [chrome, setChrome] = useState<SoftproofPublicChrome>(() => getSoftproofPublicChrome("cs"));

  const apiBase = `/api/public/softproof/${encodeURIComponent(token)}`;

  useEffect(() => {
    const previousLang = document.documentElement.lang || "cs";
    return () => {
      document.documentElement.lang = previousLang;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(apiBase)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (typeof data.locale === "string") {
          applyHtmlLang(data.locale);
          setChrome(getSoftproofPublicChrome(data.locale));
        }
        if (res.status === 410 || res.status === 404) {
          const fallback = getSoftproofPublicChrome(
            typeof data.locale === "string" ? data.locale : "cs"
          );
          setBlocked(
            typeof data.message === "string" ? data.message : fallback.invalidLink
          );
          return;
        }
        if (!res.ok || data.status !== "ok") {
          const fallback = getSoftproofPublicChrome(
            typeof data.locale === "string" ? data.locale : "cs"
          );
          setBlocked(typeof data.error === "string" ? data.error : fallback.cannotOpen);
          return;
        }
        setMeta(data as MetaOk);
      })
      .catch(() => {
        if (!cancelled) setBlocked(getSoftproofPublicChrome("cs").networkError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const ui = meta?.texts ?? chrome;

  const decide = async (action: "approved" | "rejected") => {
    setError(null);
    if (action === "rejected" && !reason.trim()) {
      setError(ui.rejectRequired);
      return;
    }
    setSubmitting(action);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "approved" ? { action } : { action, reason: reason.trim() }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : typeof data.message === "string"
              ? data.message
              : ui.actionFailed
        );
        return;
      }
      setRejectOpen(false);
      setDone(action);
    } catch {
      setError(ui.networkError);
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-600">{chrome.loading}</p>;
  }

  if (blocked) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-amber-950">Softproof</h1>
        <p className="mt-2 whitespace-pre-wrap text-sm text-amber-900">{blocked}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-green-200 bg-green-50 p-6">
        <h1 className="text-lg font-semibold text-green-950">
          {done === "approved" ? meta?.texts.approveLabel ?? "OK" : meta?.texts.rejectLabel ?? "OK"}
        </h1>
        <p className="mt-2 text-sm text-green-900">
          {done === "approved" ? ui.approvedThanks : ui.rejectedThanks}
        </p>
      </div>
    );
  }

  if (!meta) return null;

  const previewUrl = `${apiBase}?file=1`;
  const downloadUrl = `${apiBase}?download=1`;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">{meta.texts.pageTitle}</h1>
        <p className="mt-1 text-sm text-gray-600">{meta.texts.pageHint}</p>
        {meta.orderNumber && (
          <p className="mt-2 text-sm text-gray-700">
            <strong>#{meta.maketaId}</strong>
            {meta.orderNumber ? ` · ${meta.orderNumber}` : ""}
            {meta.labelCode ? ` · ${meta.labelCode}` : ""}
          </p>
        )}
        <p className="mt-1 text-sm text-gray-500">{meta.fileName}</p>
        {meta.texts.legalHtml.trim() && (
          <div className="mt-4 whitespace-pre-wrap rounded-lg border-l-4 border-blue-500 bg-blue-50 px-3 py-2 text-sm text-blue-950">
            {meta.texts.legalHtml}
          </div>
        )}
      </div>

      {meta.canPreview && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {meta.mime.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={meta.fileName} className="max-h-[70vh] w-full object-contain" />
          ) : (
            <iframe title={meta.fileName} src={previewUrl} className="h-[70vh] w-full" />
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <a
          href={downloadUrl}
          className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {meta.texts.downloadLabel}
        </a>

        <div className="mt-6 space-y-3 border-t border-gray-100 pt-4">
          {error && !rejectOpen && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={submitting != null}
              onClick={() => void decide("approved")}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {submitting === "approved" ? "…" : meta.texts.approveLabel}
            </button>
            <button
              type="button"
              disabled={submitting != null}
              onClick={() => {
                setError(null);
                setRejectOpen(true);
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {meta.texts.rejectLabel}
            </button>
          </div>
        </div>
      </div>

      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="softproof-reject-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
          >
            <h2 id="softproof-reject-title" className="text-lg font-semibold text-gray-900">
              {meta.texts.rejectLabel}
            </h2>
            <label className="mt-4 block text-sm font-medium text-gray-700">
              {meta.texts.rejectReasonLabel}
              <textarea
                rows={4}
                autoFocus
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting != null}
              />
            </label>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting != null}
                onClick={() => {
                  setRejectOpen(false);
                  setReason("");
                  setError(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {ui.cancelLabel}
              </button>
              <button
                type="button"
                disabled={submitting != null}
                onClick={() => void decide("rejected")}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {submitting === "rejected" ? "…" : meta.texts.rejectLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

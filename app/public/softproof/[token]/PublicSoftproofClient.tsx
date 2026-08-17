"use client";

import { useEffect, useState } from "react";

type Texts = {
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
  fileName: string;
  mime: string;
  canPreview: boolean;
  labelCode: string | null;
  orderNumber: string | null;
  maketaId: number;
  texts: Texts;
};

export function PublicSoftproofClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<MetaOk | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState<"approved" | "rejected" | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  const apiBase = `/api/public/softproof/${encodeURIComponent(token)}`;

  useEffect(() => {
    let cancelled = false;
    fetch(apiBase)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 410 || res.status === 404) {
          setBlocked(typeof data.message === "string" ? data.message : "Odkaz není platný.");
          return;
        }
        if (!res.ok || data.status !== "ok") {
          setBlocked(typeof data.error === "string" ? data.error : "Odkaz nelze otevřít.");
          return;
        }
        setMeta(data as MetaOk);
      })
      .catch(() => {
        if (!cancelled) setBlocked("Síťová chyba");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const decide = async (action: "approved" | "rejected") => {
    setError(null);
    setSubmitting(action);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : typeof data.message === "string" ? data.message : "Akce se nezdařila");
        return;
      }
      setDone(action);
    } catch {
      setError("Síťová chyba");
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-600">Načítám náhled…</p>;
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
          {done === "approved"
            ? "Děkujeme, schválení bylo zaznamenáno. Tento odkaz už nelze znovu použít."
            : "Děkujeme, zamítnutí bylo zaznamenáno. Tento odkaz už nelze znovu použít."}
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
          <label className="block text-sm font-medium text-gray-700">
            {meta.texts.rejectReasonLabel}
            <textarea
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting != null}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
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
              onClick={() => void decide("rejected")}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting === "rejected" ? "…" : meta.texts.rejectLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

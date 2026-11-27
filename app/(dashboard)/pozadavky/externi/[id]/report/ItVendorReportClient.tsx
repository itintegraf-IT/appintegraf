"use client";

import Link from "next/link";
import { useState } from "react";
import type { ItVendorReportData } from "@/lib/it-vendor-request/report";
import "./report-print.css";

type Props = {
  id: number;
  data: ItVendorReportData;
  reportHtml: string;
};

export function ItVendorReportClient({ id, data, reportHtml }: Props) {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [email, setEmail] = useState(
    data.contact_email || data.contacts?.find((c) => c.email)?.email || ""
  );

  const send = async () => {
    setSending(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`/api/it-vendor-requests/${id}/send-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setErr(body.error ?? "Odeslání selhalo");
      else setMsg(body.message ?? "Report odeslán e-mailem");
    } catch {
      setErr("Chyba sítě");
    }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/pozadavky/externi/${id}/edit`}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            ← Zpět na úpravu
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            Report pro dodavatele
          </h1>
          <p className="text-sm text-gray-600">{data.request_number}</p>
          {data.status !== "approved" && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Požadavek ještě není schválený (stav: {data.status_label}). Níže je náhled
              reportu.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">E-mail příjemce</span>
            <input
              type="email"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dodavatel@firma.cz"
            />
          </label>
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !email.trim()}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Odeslat e-mailem
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Tisknout
          </button>
        </div>
      </div>

      {(msg || err) && (
        <div
          className={`no-print rounded-md border px-3 py-2 text-sm ${
            err
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {err || msg}
        </div>
      )}

      <div
        className="report-print rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        dangerouslySetInnerHTML={{ __html: reportHtml }}
      />
    </div>
  );
}

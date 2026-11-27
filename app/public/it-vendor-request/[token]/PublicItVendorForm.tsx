"use client";

import { useEffect, useState } from "react";
import { ItVendorForm } from "@/app/(dashboard)/pozadavky/_components/it-vendor/ItVendorForm";
import {
  formFromItem,
  formToApiPayload,
  type FormState,
  type Lookups,
} from "@/app/(dashboard)/pozadavky/_components/it-vendor/types";

type Props = { token: string };

export function PublicItVendorForm({ token }: Props) {
  const [form, setForm] = useState<FormState | null>(null);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [meta, setMeta] = useState<{
    request_number: string;
    status: string;
    editable: boolean;
  } | null>(null);
  const [section, setSection] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/it-vendor-request/${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setErr(data.error ?? "Odkaz není platný");
          setLoading(false);
          return;
        }
        setForm(formFromItem(data.item));
        setLookups(data.lookups);
        setMeta({
          request_number: data.item.request_number,
          status: data.item.status,
          editable: Boolean(data.item.editable),
        });
        if (!data.item.editable) {
          setDone(data.item.status !== "sent");
        }
      } catch {
        if (!cancelled) setErr("Chyba při načítání formuláře");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const payload = () => {
    if (!form) return null;
    return { ...formToApiPayload(form, { includeIt: false }), website: "" };
  };

  const saveDraft = async () => {
    if (!form || !meta?.editable) return;
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`/api/public/it-vendor-request/${encodeURIComponent(token)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data.error ?? "Uložení selhalo");
      else {
        setMsg("Koncept uložen. Můžete pokračovat později přes stejný odkaz.");
        if (data.item) setForm(formFromItem(data.item));
      }
    } catch {
      setErr("Chyba sítě");
    }
    setSaving(false);
  };

  const submit = async () => {
    if (!form || !meta?.editable) return;
    if (!confirm("Opravdu odeslat formulář? Po odeslání už nebude možné údaje upravit.")) {
      return;
    }
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`/api/public/it-vendor-request/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data.error ?? "Odeslání selhalo");
      else {
        setDone(true);
        setMsg(data.message ?? "Odesláno. Děkujeme.");
        setMeta((m) => (m ? { ...m, editable: false, status: "submitted" } : m));
      }
    } catch {
      setErr("Chyba sítě");
    }
    setSaving(false);
  };

  if (loading) {
    return <p className="text-gray-500">Načítání formuláře…</p>;
  }

  if (err && !form) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h1 className="text-lg font-semibold">Formulář není dostupný</h1>
        <p className="mt-2 text-sm">{err}</p>
      </div>
    );
  }

  if (!form || !lookups || !meta) return null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-red-600">INTEGRAF · IT požadavky</p>
        <h1 className="text-2xl font-bold text-gray-900">
          Formulář pro externího dodavatele
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Evidenční číslo: <strong>{meta.request_number}</strong>
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Vyplňte 4 sekce: identifikace, zařízení (včetně požadavku na počet IP), porty/firewall,
          přístup a podpis. <strong>IP adresy a číslo VLAN přidělí IT</strong> — nevyplňujte je.
          Odkaz slouží pouze k tomuto formuláři.
        </p>
      </div>

      {(msg || err) && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            err
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {err || msg}
        </div>
      )}

      {done && !meta.editable ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-green-900">
          <h2 className="text-lg font-semibold">Formulář byl odeslán</h2>
          <p className="mt-2 text-sm">
            Děkujeme. IT oddělení INTEGRAF údaje zpracuje a přidělí síťové parametry. Tento odkaz
            je nyní pouze pro náhled.
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          name="website"
          autoComplete="off"
          tabIndex={-1}
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
          aria-hidden
        />
        <ItVendorForm
          form={form}
          setForm={(updater) => setForm((prev) => (prev ? updater(prev) : prev))}
          lookups={lookups}
          mode="vendor"
          readOnly={!meta.editable}
          section={section}
          onSectionChange={setSection}
        />
      </div>

      {meta.editable && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveDraft()}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Uložit koncept
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Odeslat formulář
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ItVendorForm } from "../../_components/it-vendor/ItVendorForm";
import {
  formFromItem,
  formToApiPayload,
  type FormState,
  type Lookups,
} from "../../_components/it-vendor/types";

type Props = {
  id: number;
  /** view = jen prohlížení; edit = úpravy (jako produkty) */
  mode?: "view" | "edit";
};

export function ItVendorDetailClient({ id, mode = "edit" }: Props) {
  const isView = mode === "view";
  const [form, setForm] = useState<FormState | null>(null);
  const [meta, setMeta] = useState<{
    request_number: string;
    status: string;
    status_label?: string;
    links?: { id: number; sent_to_email: string; expires_at: string | null; active: boolean }[];
    rejection_reason?: string | null;
  } | null>(null);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>({});
  const [section, setSection] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [sendEmail, setSendEmail] = useState("");
  const [sendMsg, setSendMsg] = useState("");
  const [lastUrl, setLastUrl] = useState("");
  const [approveName, setApproveName] = useState("");
  const [assignedItUserId, setAssignedItUserId] = useState<number | "">("");
  const [pmName, setPmName] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [itUsers, setItUsers] = useState<{ id: number; name: string; email: string }[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/it-vendor-requests/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Nelze načíst");
        setForm(null);
      } else {
        setForm(formFromItem(data.item));
        setLookups(data.lookups);
        setStatusLabels(data.status_labels ?? {});
        setMeta({
          request_number: data.item.request_number,
          status: data.item.status,
          status_label: data.status_labels?.[data.item.status],
          links: data.item.links,
          rejection_reason: data.item.rejection_reason,
        });
        setSendEmail(data.item.contact_email || "");
        setApproveName(data.item.it_name || "");
        setAssignedItUserId(data.item.assigned_it_user_id ?? "");
        setPmName(data.item.pm_name || "");
      }
    } catch {
      setErr("Chyba sítě");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetch("/api/it-vendor-requests/it-users")
      .then((r) => r.json())
      .then((d) => {
        setItUsers(d.items ?? []);
        setCurrentUserId(d.current_user_id ?? null);
      })
      .catch(() => setItUsers([]));
  }, []);

  // Výchozí IT zpracovatel = přihlášený, pokud je v IT a ještě není vybraný
  useEffect(() => {
    if (assignedItUserId !== "" || currentUserId == null || itUsers.length === 0) return;
    const me = itUsers.find((u) => u.id === currentUserId);
    if (!me) return;
    setAssignedItUserId(me.id);
    if (!approveName) setApproveName(me.name);
  }, [assignedItUserId, currentUserId, itUsers, approveName]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`/api/it-vendor-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToApiPayload(form, { includeIt: true })),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Uložení selhalo");
      } else {
        setMsg("Uloženo");
        if (data.item) {
          setForm(formFromItem(data.item));
          setMeta((m) =>
            m
              ? {
                  ...m,
                  status: data.item.status,
                  status_label: statusLabels[data.item.status] ?? data.item.status,
                  links: data.item.links,
                }
              : m
          );
        }
      }
    } catch {
      setErr("Chyba při ukládání");
    }
    setSaving(false);
  };

  const sendLink = async (copyOnly: boolean) => {
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`/api/it-vendor-requests/${id}/send-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: sendEmail || undefined,
          message: sendMsg || undefined,
          copy_only: copyOnly,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Odeslání selhalo");
        return;
      }
      setLastUrl(data.pageUrl || "");
      if (data.pageUrl) {
        try {
          await navigator.clipboard.writeText(data.pageUrl);
        } catch {
          /* ignore */
        }
      }
      if (data.emailError) {
        setMsg(`Odkaz vytvořen (zkopírován), e-mail selhal: ${data.emailError}`);
      } else if (copyOnly) {
        setMsg("Odkaz vytvořen a zkopírován do schránky");
      } else {
        setMsg(data.emailSent ? "Odkaz odeslán e-mailem a zkopírován" : "Odkaz vytvořen");
      }
      void load();
    } catch {
      setErr("Chyba při odesílání odkazu");
    }
  };

  const approve = async () => {
    setErr("");
    const selected =
      assignedItUserId !== ""
        ? itUsers.find((u) => u.id === assignedItUserId)
        : null;
    const name = selected?.name || approveName.trim();
    if (!name) {
      setErr("Vyberte IT zpracovatele");
      return;
    }
    const res = await fetch(`/api/it-vendor-requests/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        it_name: name,
        assigned_it_user_id: selected?.id ?? null,
        pm_name: pmName || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setErr(data.error ?? "Schválení selhalo");
    else {
      setMsg("Schváleno");
      void load();
    }
  };

  const reject = async () => {
    setErr("");
    const res = await fetch(`/api/it-vendor-requests/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setErr(data.error ?? "Zamítnutí selhalo");
    else {
      setMsg("Zamítnuto");
      void load();
    }
  };

  const setInReview = async () => {
    if (!form) return;
    setSaving(true);
    const res = await fetch(`/api/it-vendor-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formToApiPayload(form, { includeIt: true }),
        status: "in_review",
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMsg("Stav: v kontrole IT");
      void load();
    }
  };

  const remove = async () => {
    const num = meta?.request_number ?? String(id);
    if (
      !window.confirm(
        `Opravdu trvale smazat požadavek ${num}?\nTuto akci nelze vrátit.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setErr("");
    try {
      const res = await fetch(`/api/it-vendor-requests/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Smazání selhalo");
        setDeleting(false);
        return;
      }
      window.location.href = "/pozadavky?tab=externi";
    } catch {
      setErr("Chyba při mazání");
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500">Načítání…</p>;
  }
  if (!form || !lookups || !meta) {
    return (
      <div className="space-y-2">
        <p className="text-red-600">{err || "Nenalezeno"}</p>
        <Link href="/pozadavky?tab=externi" className="text-sm text-red-600 underline">
          Zpět na seznam
        </Link>
      </div>
    );
  }

  /** View vždy jen čtení; v edit je zrušený zamčený, schválený jde dál upravovat. */
  const readOnly = isView || meta.status === "cancelled";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/pozadavky?tab=externi" className="text-sm text-gray-500 hover:text-gray-800">
            ← Externí dodavatelé
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{meta.request_number}</h1>
          <p className="text-sm text-gray-600">
            Stav: <strong>{meta.status_label ?? meta.status}</strong>
            {isView ? (
              <span className="ml-2 text-xs font-normal text-gray-500">(prohlížení)</span>
            ) : null}
          </p>
          {!isView && meta.status === "approved" && (
            <p className="mt-1 text-sm text-slate-600">
              Požadavek je schválený — úpravy IP / poznámek jsou stále možné, pak znovu Uložit.
            </p>
          )}
          {meta.rejection_reason && (
            <p className="mt-1 text-sm text-red-700">Důvod zamítnutí: {meta.rejection_reason}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/pozadavky/externi/${id}/report`}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Report pro dodavatele
          </Link>
          {isView ? (
            meta.status !== "cancelled" && (
              <Link
                href={`/pozadavky/externi/${id}/edit`}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Upravit
              </Link>
            )
          ) : (
            <>
              <Link
                href={`/pozadavky/externi/${id}`}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Prohlížet
              </Link>
              <button
                type="button"
                disabled={saving || readOnly}
                onClick={() => void save()}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Uložit
              </button>
              {meta.status === "submitted" && (
                <button
                  type="button"
                  onClick={() => void setInReview()}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  Označit v kontrole
                </button>
              )}
              <button
                type="button"
                disabled={deleting}
                onClick={() => void remove()}
                className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Smazat
              </button>
            </>
          )}
        </div>
      </div>

      {(msg || err) && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            err ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {err || msg}
          {lastUrl && (
            <div className="mt-1 break-all text-xs text-gray-600">{lastUrl}</div>
          )}
        </div>
      )}

      {!isView && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-900">Odkaz pro dodavatele</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">E-mail</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Zpráva (volitelně)</span>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={2}
                value={sendMsg}
                onChange={(e) => setSendMsg(e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void sendLink(false)}
              className="rounded-md bg-gray-900 px-3 py-2 text-sm text-white"
            >
              Odeslat e-mailem
            </button>
            <button
              type="button"
              onClick={() => void sendLink(true)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              Jen vytvořit a zkopírovat odkaz
            </button>
            <button
              type="button"
              onClick={async () => {
                await fetch(`/api/it-vendor-requests/${id}/revoke-link`, { method: "POST" });
                setMsg("Aktivní odkazy zrušeny");
                void load();
              }}
              className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700"
            >
              Zrušit odkazy
            </button>
          </div>
          {meta.links && meta.links.length > 0 && (
            <ul className="text-xs text-gray-600 space-y-1">
              {meta.links.map((l) => (
                <li key={l.id}>
                  {l.sent_to_email} · expirace{" "}
                  {l.expires_at ? new Date(l.expires_at).toLocaleString("cs-CZ") : "—"} ·{" "}
                  {l.active ? "aktivní" : "neplatný"}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isView && meta.links && meta.links.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold text-gray-900">Odkazy pro dodavatele</h2>
          <ul className="space-y-1 text-xs text-gray-600">
            {meta.links.map((l) => (
              <li key={l.id}>
                {l.sent_to_email} · expirace{" "}
                {l.expires_at ? new Date(l.expires_at).toLocaleString("cs-CZ") : "—"} ·{" "}
                {l.active ? "aktivní" : "neplatný"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isView && (meta.status === "submitted" || meta.status === "in_review") && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-950">Čeká na schválení</h2>
          <p className="mt-1 text-sm text-amber-900">
            Prohlížení je jen pro čtení. Schválení, zamítnutí a výběr IT zpracovatele jsou v
            úpravě.
          </p>
          <Link
            href={`/pozadavky/externi/${id}/edit`}
            className="mt-3 inline-flex rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900"
          >
            Přejít na schválení
          </Link>
        </div>
      )}

      {!isView && (meta.status === "submitted" || meta.status === "in_review") && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">Schválení / zamítnutí</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">IT zpracovatel / schvalovatel</span>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={assignedItUserId === "" ? "" : String(assignedItUserId)}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : "";
                  setAssignedItUserId(v);
                  const u = typeof v === "number" ? itUsers.find((x) => x.id === v) : null;
                  setApproveName(u?.name || "");
                }}
              >
                <option value="">— vyberte uživatele IT —</option>
                {itUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.email ? ` (${u.email})` : ""}
                  </option>
                ))}
              </select>
              {itUsers.length === 0 && (
                <span className="mt-1 block text-xs text-amber-800">
                  Žádní uživatelé v oddělení IT — zkontrolujte přiřazení oddělení.
                </span>
              )}
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Vedoucí projektu</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={pmName}
                onChange={(e) => setPmName(e.target.value)}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Důvod zamítnutí</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void approve()}
              className="rounded-md bg-green-600 px-3 py-2 text-sm text-white"
            >
              Schválit
            </button>
            <button
              type="button"
              onClick={() => void reject()}
              className="rounded-md bg-red-600 px-3 py-2 text-sm text-white"
            >
              Zamítnout
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <ItVendorForm
          form={form}
          setForm={(updater) => setForm((prev) => (prev ? updater(prev) : prev))}
          lookups={lookups}
          mode="internal"
          readOnly={readOnly}
          section={section}
          onSectionChange={setSection}
          onSave={isView ? undefined : () => void save()}
          saving={saving}
          requestId={id}
        />
      </div>
    </div>
  );
}

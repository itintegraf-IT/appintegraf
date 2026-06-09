"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EntityType = "COMPANY" | "CONTACT" | "USER";

export function GdprForm() {
  const [entityType, setEntityType] = useState<EntityType>("COMPANY");
  const [entityId, setEntityId] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onExport() {
    if (!entityId.trim()) {
      setMessage({ kind: "err", text: "Zadej ID entity." });
      return;
    }
    setBusy("export");
    setMessage(null);
    try {
      const res = await fetch("/api/crm/gdpr/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId: entityId.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage({ kind: "err", text: body.error ?? `Chyba ${res.status}` });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `gdpr-export-${entityType.toLowerCase()}.json`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage({ kind: "ok", text: `Export stažen: ${filename}` });
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    if (!entityId.trim()) {
      setMessage({ kind: "err", text: "Zadej ID entity." });
      return;
    }
    if (entityType === "USER") {
      setMessage({ kind: "err", text: "Mazání USER proveď přes /admin/users." });
      return;
    }
    if (confirm !== "SMAZAT") {
      setMessage({ kind: "err", text: "Pro potvrzení napiš přesně SMAZAT." });
      return;
    }
    if (!window.confirm(`Opravdu smazat ${entityType} ${entityId}? Tato akce je nevratná.`)) return;
    setBusy("delete");
    setMessage(null);
    try {
      const res = await fetch("/api/crm/gdpr/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId: entityId.trim(), confirm: "SMAZAT" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage({ kind: "err", text: body.error ?? `Chyba ${res.status}` });
        return;
      }
      setMessage({ kind: "ok", text: `Smazáno: ${entityType} ${entityId.trim()}` });
      setEntityId("");
      setConfirm("");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entityType">Typ entity</Label>
          <select
            id="entityType"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as EntityType)}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
          >
            <option value="COMPANY">Firma (Company)</option>
            <option value="CONTACT">Kontakt (Contact)</option>
            <option value="USER">Uživatel (User) — jen export</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entityId">ID entity</Label>
          <Input
            id="entityId"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder={entityType === "USER" ? "např. 42" : "např. clabc123..."}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onExport} disabled={busy !== null}>
          {busy === "export" ? "Exportuji..." : "Stáhnout JSON export"}
        </Button>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-900">Kaskádové smazání</h3>
        <p className="mt-1 text-xs text-gray-500">
          Smaže entitu včetně všech souvisejících aktivit, poznámek a příloh. USER se nemaže tímto
          nástrojem — použij centrální správu uživatelů.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm">Potvrzení (napiš &quot;SMAZAT&quot;)</Label>
            <Input
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="SMAZAT"
              autoComplete="off"
              className="w-40"
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={busy !== null || entityType === "USER" || confirm !== "SMAZAT"}
          >
            {busy === "delete" ? "Mažu..." : "Kaskádově smazat"}
          </Button>
        </div>
      </div>

      {message ? (
        <div
          className={
            "rounded-md border px-3 py-2 text-sm " +
            (message.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700")
          }
        >
          {message.text}
        </div>
      ) : null}
    </div>
  );
}

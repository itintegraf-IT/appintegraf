"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { EquipmentDialog } from "../../_components/EquipmentDialog";
import { readApiResponse } from "@/lib/equipment/api-response";

type GroupItem = { id: number; assetTag?: string | null; name?: string };
type Group = { kind: string; label: string; count: number; items: GroupItem[] };

type RoomRow = {
  itemId: number;
  roomId: number;
  reason: "code_name" | "code_alias" | "code_name_differs" | "name_only";
  location: string;
  assetTag: string | null;
  itemName: string;
  roomCode: string;
  roomName: string;
};
type RoomsPreview = {
  auto: RoomRow[];
  suggest: RoomRow[];
  groups: Group[];
  skipped: { alreadyPlaced: number; retired: number };
  inventoryInProgress: boolean;
};

type HolderRow = {
  itemId: number;
  userId: number;
  kind: "full" | "surname";
  holderText: string;
  warning: "same_name_holder" | null;
  assetTag: string | null;
  itemName: string;
  userName: string;
};
type HoldersPreview = {
  rows: HolderRow[];
  groups: Group[];
  skipped: { notInStock: number; alreadyAssigned: number };
  inventoryInProgress: boolean;
};

type ApplyResult = { applied: number; skipped: { itemId: number; reason: string }[] };

const ROOM_REASON: Record<RoomRow["reason"], string> = {
  code_name: "kód i název",
  code_alias: "dřívější název místnosti",
  code_name_differs: "kód sedí, název ne",
  name_only: "jen podle názvu",
};

const GROUP_KIND: Record<string, string> = {
  empty: "bez umístění",
  costCenter: "středisko místo místnosti",
  unknownCode: "kód, který není mezi místnostmi",
  text: "text bez jednoznačné místnosti",
  ambiguous: "jméno odpovídá více lidem",
  none: "pracoviště nebo člověk bez účtu",
};

function Banner({ tone, children }: { tone: "info" | "warning" | "error" | "success"; children: React.ReactNode }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? AlertCircle : tone === "warning" ? AlertTriangle : Info;
  const color =
    tone === "success" ? "text-(--success)" : tone === "error" ? "text-destructive" : tone === "warning" ? "text-(--warning)" : "text-muted-foreground";
  return (
    <p
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm"
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function Groups({ groups, note }: { groups: Group[]; note: string }) {
  if (groups.length === 0) return null;
  const total = groups.reduce((sum, g) => sum + g.count, 0);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">Zůstane k ručnímu dořešení: {total}</h3>
      <p className="text-sm text-muted-foreground">{note}</p>
      <ul className="flex flex-col gap-1">
        {groups.map((g) => (
          <li key={`${g.kind}:${g.label}`}>
            <details className="rounded-lg border border-border bg-card">
              <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 px-3 text-sm">
                <span className="font-medium">{g.label}</span>
                <span className="text-muted-foreground">· {GROUP_KIND[g.kind] ?? g.kind}</span>
                <span className="ml-auto font-semibold tabular-nums">{g.count}</span>
              </summary>
              <ul className="max-h-60 overflow-y-auto border-t border-border px-3 py-2 text-sm">
                {g.items.map((it) => (
                  <li key={it.id} className="flex gap-2 py-0.5">
                    <Link href={`/equipment/${it.id}`} className="font-mono text-primary hover:underline">
                      {it.assetTag ?? `#${it.id}`}
                    </Link>
                    <span className="min-w-0 truncate">{it.name}</span>
                  </li>
                ))}
                {g.count > g.items.length ? (
                  <li className="py-0.5 text-muted-foreground">… a dalších {g.count - g.items.length}</li>
                ) : null}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

function useApply<T>(step: "rooms" | "holders", reload: () => void) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);

  const apply = (pairs: T[], doneLabel: (n: number) => string) => {
    setBusy(true);
    setResult(null);
    fetch(`/api/equipment/data-prep/${step}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairs }),
    })
      .then((res) => readApiResponse<ApplyResult>(res, "Úklid dat se nepodařil. Nic se nezměnilo."))
      .then((r) => {
        setConfirmOpen(false);
        if (!r.ok) {
          setResult({ tone: "error", text: r.error });
          return;
        }
        const skipped = r.data.skipped.length;
        setResult({
          tone: skipped ? "warning" : "success",
          text: `${doneLabel(r.data.applied)}${skipped ? ` ${skipped} řádků se mezitím změnilo a přeskočilo se — náhled je načtený znovu.` : ""}`,
        });
        reload();
      })
      .catch(() => {
        setConfirmOpen(false);
        setResult({ tone: "error", text: "Spojení se serverem selhalo. Nic se nezměnilo — zkuste to znovu." });
      })
      .finally(() => setBusy(false));
  };

  return { confirmOpen, setConfirmOpen, busy, result, apply };
}

function RoomsStep() {
  const [preview, setPreview] = useState<RoomsPreview | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    fetch("/api/equipment/data-prep/rooms")
      .then((res) => readApiResponse<RoomsPreview>(res, "Náhled se nepodařilo načíst."))
      .then((r) => {
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setPreview(r.data);
        setChecked(new Set(r.data.auto.map((p) => p.itemId)));
      })
      .catch(() => setError("Spojení se serverem selhalo. Zkuste to znovu."))
      .finally(() => setLoading(false));
  };
  const { confirmOpen, setConfirmOpen, busy, result, apply } = useApply<{ itemId: number; roomId: number }>("rooms", load);

  const rows = preview ? [...preview.auto, ...preview.suggest] : [];
  const selected = rows.filter((r) => checked.has(r.itemId));
  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6" aria-labelledby="prep-rooms">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="prep-rooms" className="text-lg font-semibold">
            1. Místnosti podle textu umístění
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Položky z původní evidence mají místnost jen v textu („Název (kód)“). Automaticky se zařadí ty, kde sedí kód
            i název; návrhy potvrďte zaškrtnutím. Původní text zůstane a v historii bude „Z původní evidence“.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="min-h-11 rounded-lg border border-border px-4 font-medium hover:bg-muted disabled:opacity-50"
        >
          {loading ? "Načítám…" : preview ? "Načíst znovu" : "Načíst náhled"}
        </button>
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {result ? <Banner tone={result.tone}>{result.text}</Banner> : null}
      {preview?.inventoryInProgress ? (
        <Banner tone="warning">Probíhá inventura — provést úklid půjde až po jejím uzavření.</Banner>
      ) : null}
      {preview ? (
        <>
          <p className="text-sm">
            Automaticky <strong>{preview.auto.length}</strong> · návrhy <strong>{preview.suggest.length}</strong> · už
            v místnosti {preview.skipped.alreadyPlaced}
          </p>
          {rows.length > 0 ? (
            <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="sticky top-0 bg-muted text-left">
                  <tr>
                    <th className="px-3 py-2">
                      <span className="sr-only">Vybrat</span>
                    </th>
                    <th className="px-3 py-2">Inv. č.</th>
                    <th className="px-3 py-2">Název</th>
                    <th className="px-3 py-2">Text umístění</th>
                    <th className="px-3 py-2">Místnost</th>
                    <th className="px-3 py-2">Shoda</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.itemId} className="border-t border-border">
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={checked.has(r.itemId)}
                          onChange={() => toggle(r.itemId)}
                          aria-label={`Zařadit ${r.assetTag ?? r.itemName}`}
                        />
                      </td>
                      <td className="px-3 py-1.5 font-mono">{r.assetTag ?? `#${r.itemId}`}</td>
                      <td className="px-3 py-1.5">{r.itemName}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.location}</td>
                      <td className="px-3 py-1.5">
                        {r.roomCode} – {r.roomName}
                      </td>
                      <td className={`px-3 py-1.5 ${r.reason === "code_name" || r.reason === "code_alias" ? "" : "font-medium text-(--warning)"}`}>
                        {ROOM_REASON[r.reason]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Banner tone="info">Není co zařadit — všechno s rozpoznanou místností už v místnosti je.</Banner>
          )}
          {rows.length > 0 ? (
            <div>
              <button
                type="button"
                disabled={selected.length === 0 || preview.inventoryInProgress || busy}
                onClick={() => setConfirmOpen(true)}
                className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Zařadit vybrané ({selected.length})
              </button>
            </div>
          ) : null}
          <Groups
            groups={preview.groups}
            note="Tyhle položky aplikace z textu nezařadí. Projdete je při obchůzce se štítky (místnost nastavíte skenem nebo hromadným přesunem); Praha a vozíky se zařadí samy, až v Místnostech založíte jejich místa."
          />
          <EquipmentDialog
            open={confirmOpen}
            title={`Zařadit ${selected.length} položek do místností?`}
            confirmLabel={busy ? "Zařazuji…" : "Zařadit"}
            busy={busy}
            onConfirm={() =>
              apply(
                selected.map((r) => ({ itemId: r.itemId, roomId: r.roomId })),
                (n) => `Zařazeno ${n} položek do místností.`
              )
            }
            onCancel={() => setConfirmOpen(false)}
          >
            Původní text umístění zůstane, v historii položek bude „Z původní evidence“ (bez protokolu přesunu). Nikomu nic
            neodejde. Položky, které se mezitím změnily, se přeskočí.
          </EquipmentDialog>
        </>
      ) : null}
    </section>
  );
}

function HoldersStep() {
  const [preview, setPreview] = useState<HoldersPreview | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    fetch("/api/equipment/data-prep/holders")
      .then((res) => readApiResponse<HoldersPreview>(res, "Náhled se nepodařilo načíst."))
      .then((r) => {
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setPreview(r.data);
        setChecked(new Set(r.data.rows.filter((row) => row.kind === "full" && !row.warning).map((row) => row.itemId)));
      })
      .catch(() => setError("Spojení se serverem selhalo. Zkuste to znovu."))
      .finally(() => setLoading(false));
  };
  const { confirmOpen, setConfirmOpen, busy, result, apply } = useApply<{ itemId: number; userId: number }>("holders", load);

  const rows = preview?.rows ?? [];
  const selected = rows.filter((r) => checked.has(r.itemId));
  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6" aria-labelledby="prep-holders">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="prep-holders" className="text-lg font-semibold">
            2. Držitelé z poznámek
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Poznámka „Pracovník: …“ z původní evidence. Předvybrané jsou jen shody celého jména; shodu podle příjmení
            zkontrolujte a zaškrtněte. Pracoviště a nejednoznačná jména se nepřiřadí. Nikomu nic neodejde.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="min-h-11 rounded-lg border border-border px-4 font-medium hover:bg-muted disabled:opacity-50"
        >
          {loading ? "Načítám…" : preview ? "Načíst znovu" : "Načíst náhled"}
        </button>
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {result ? <Banner tone={result.tone}>{result.text}</Banner> : null}
      {preview?.inventoryInProgress ? (
        <Banner tone="warning">Probíhá inventura — provést úklid půjde až po jejím uzavření.</Banner>
      ) : null}
      {preview ? (
        <>
          <p className="text-sm">
            Celé jméno <strong>{rows.filter((r) => r.kind === "full").length}</strong> · jen příjmení{" "}
            <strong>{rows.filter((r) => r.kind === "surname").length}</strong> · s upozorněním{" "}
            <strong>{rows.filter((r) => r.warning).length}</strong>
          </p>
          {rows.length > 0 ? (
            <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="sticky top-0 bg-muted text-left">
                  <tr>
                    <th className="px-3 py-2">
                      <span className="sr-only">Vybrat</span>
                    </th>
                    <th className="px-3 py-2">Inv. č.</th>
                    <th className="px-3 py-2">Název</th>
                    <th className="px-3 py-2">V poznámce</th>
                    <th className="px-3 py-2">Držitel</th>
                    <th className="px-3 py-2">Shoda</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.itemId} className="border-t border-border">
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={checked.has(r.itemId)}
                          onChange={() => toggle(r.itemId)}
                          aria-label={`Přiřadit ${r.assetTag ?? r.itemName}`}
                        />
                      </td>
                      <td className="px-3 py-1.5 font-mono">{r.assetTag ?? `#${r.itemId}`}</td>
                      <td className="px-3 py-1.5">{r.itemName}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.holderText}</td>
                      <td className="px-3 py-1.5">{r.userName}</td>
                      <td className="px-3 py-1.5">
                        <span className={r.kind === "surname" ? "font-medium text-(--warning)" : ""}>
                          {r.kind === "full" ? "celé jméno" : "jen příjmení"}
                        </span>
                        {r.warning ? (
                          <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-(--warning)">
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                            má podobnou položku — možná duplicita
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Banner tone="info">Není koho přiřadit.</Banner>
          )}
          {rows.length > 0 ? (
            <div>
              <button
                type="button"
                disabled={selected.length === 0 || preview.inventoryInProgress || busy}
                onClick={() => setConfirmOpen(true)}
                className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Přiřadit vybrané ({selected.length})
              </button>
            </div>
          ) : null}
          <Groups
            groups={preview.groups}
            note="Pracoviště (tiskárna, sklad…) nejsou držitelé; nejednoznačná jména a lidi bez účtu přiřaďte ručně na kartě položky."
          />
          <EquipmentDialog
            open={confirmOpen}
            title={`Přiřadit ${selected.length} položek držitelům?`}
            confirmLabel={busy ? "Přiřazuji…" : "Přiřadit"}
            busy={busy}
            onConfirm={() =>
              apply(
                selected.map((r) => ({ itemId: r.itemId, userId: r.userId })),
                (n) => `Přiřazeno ${n} položek držitelům.`
              )
            }
            onCancel={() => setConfirmOpen(false)}
          >
            Položky přejdou ze stavu Skladem do Přiřazeno a objeví se držitelům v „Moje vybavení“. Nikomu nic neodejde.
            Položky, které se mezitím změnily, se přeskočí.
          </EquipmentDialog>
        </>
      ) : null}
    </section>
  );
}

export default function DataPrepClient() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Příprava dat</h1>
          <p className="mt-1 max-w-prose text-muted-foreground">
            Jednorázový úklid dat z původní evidence před lepením štítků a inventurou. Náhled ukáže, co se změní, provede se
            jen to, co vyberete. Nic se nemaže a každá změna je v záznamu změn.
          </p>
        </div>
        <Link href="/equipment/settings" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 hover:bg-muted">
          Zpět
        </Link>
      </div>
      <RoomsStep />
      <HoldersStep />
    </div>
  );
}

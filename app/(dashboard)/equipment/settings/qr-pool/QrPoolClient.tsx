"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PoolRow = {
  id: number;
  qr_code: string;
  asset_tag: string;
  status: string;
  batch_id: string;
  equipment_items: { id: number; name: string } | null;
};

export default function QrPoolClient() {
  const [count, setCount] = useState(20);
  const [rows, setRows] = useState<PoolRow[]>([]);
  const [batches, setBatches] = useState<{ batch_id: string; _count: { id: number } }[]>([]);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("");

  const load = () => {
    const q = filter ? `?status=${filter}` : "";
    fetch(`/api/equipment/qr-pool${q}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setBatches(d.batches ?? []);
      });
  };

  useEffect(() => {
    load();
  }, [filter]);

  const generate = async () => {
    setMsg("");
    const res = await fetch("/api/equipment/qr-pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", count }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error ?? "Chyba");
      return;
    }
    setMsg(`Vygenerováno ${data.codes?.length ?? 0} kódů (dávka ${data.batchId}).`);
    load();
  };

  const printBatch = async (batchId: string) => {
    const res = await fetch("/api/equipment/qr-pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "print_batch", batch_id: batchId }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error ?? "Chyba tisku");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-davka-${batchId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const voidCode = async (id: number) => {
    await fetch("/api/equipment/qr-pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "void", id }),
    });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Fond QR kódů</h1>
          <p className="text-gray-600">Generace, tisk a pozdější přiřazení majetku</p>
        </div>
        <Link href="/equipment/settings" className="rounded-lg border px-3 py-2 text-sm">
          Zpět
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 shadow-sm">
        <label className="text-sm">
          Počet
          <input
            type="number"
            min={1}
            max={500}
            className="ml-2 w-24 rounded border px-2 py-1"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
          />
        </label>
        <button
          type="button"
          onClick={() => void generate()}
          className="rounded-lg bg-red-600 px-4 py-2 text-white"
        >
          Generovat
        </button>
        <select
          className="rounded border px-2 py-1"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Všechny stavy</option>
          <option value="available">Volné</option>
          <option value="assigned">Přiřazené</option>
          <option value="void">Znehodnocené</option>
        </select>
      </div>
      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-2 font-semibold">Dávky</h2>
        <ul className="space-y-1 text-sm">
          {batches.map((b) => (
            <li key={b.batch_id} className="flex items-center gap-3">
              <span className="font-mono">{b.batch_id}</span>
              <span>{b._count.id} ks</span>
              <button
                type="button"
                className="text-red-700 hover:underline"
                onClick={() => void printBatch(b.batch_id)}
              >
                Tisk PDF
              </button>
            </li>
          ))}
        </ul>
      </div>

      <table className="min-w-full rounded-xl border bg-white text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">
              Inv. č.{" "}
              <span className="font-normal text-gray-500">(zadejte ručně)</span>
            </th>
            <th className="px-3 py-2">QR</th>
            <th className="px-3 py-2">Stav</th>
            <th className="px-3 py-2">Položka</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">
                <span className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-base font-semibold tracking-wide text-gray-900">
                  {r.asset_tag}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.qr_code}</td>
              <td className="px-3 py-2">{r.status}</td>
              <td className="px-3 py-2">
                {r.equipment_items ? (
                  <Link href={`/equipment/${r.equipment_items.id}`} className="text-red-700">
                    {r.equipment_items.name}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2">
                {r.status === "available" ? (
                  <button
                    type="button"
                    className="text-xs text-gray-600 hover:underline"
                    onClick={() => void voidCode(r.id)}
                  >
                    Znehodnotit
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

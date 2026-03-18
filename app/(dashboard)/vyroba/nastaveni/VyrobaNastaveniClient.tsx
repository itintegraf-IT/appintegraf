"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Settings } from "lucide-react";
import { JOB_TYPES, JOB_LABELS } from "@/lib/vyroba/config/fix-settings";

type JobConfigRow = {
  job: string;
  stav: string;
  serie: unknown;
  pocet_cna_roli: number | null;
  ks_v_krabici: number;
  prvni_role: number;
  prvni_jizd: number;
  prod: number;
  skip: number | null;
  predcisli: unknown;
  cislo_zakazky: string | null;
};

type Employee = {
  id: number;
  name: string;
  sort_order: number;
};

type Props = {
  initialAddress: string;
  initialJobConfigs: Record<string, JobConfigRow>;
  initialEmployees: Employee[];
};

export default function VyrobaNastaveniClient({
  initialAddress,
  initialJobConfigs,
  initialEmployees,
}: Props) {
  const [address, setAddress] = useState(initialAddress);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const saveAddress = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/vyroba/address", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chyba");
      setMessage({ type: "ok", text: "Adresa uložena" });
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Chyba při ukládání" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/vyroba"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Settings className="h-7 w-7 text-amber-600" />
          Nastavení výroby
        </h1>
        <p className="mt-1 text-gray-600">
          Konfigurace ADRESA (cesta pro výstupy), JOB parametry a zaměstnanci
        </p>
      </div>

      <div className="space-y-8">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">ADRESA (cesta výstupů)</h2>
          <p className="mb-3 text-sm text-gray-500">
            Kořenová cesta pro složky TISK a REZANI (např. D:\Sazka\A17144)
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="D:\Sazka\A17144"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              onClick={saveAddress}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Ukládám…" : "Uložit"}
            </button>
          </div>
          {message && (
            <p
              className={`mt-2 text-sm ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}
            >
              {message.text}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Konfigurace JOB</h2>
          <p className="mb-4 text-sm text-gray-500">
            Konfigurace jednotlivých typů produktů se upravuje v obrazovkách Generování a Kontrola.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {JOB_TYPES.map((job) => {
              const cfg = initialJobConfigs[job];
              return (
                <Link
                  key={job}
                  href={`/vyroba/generovani/${job}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3 hover:bg-amber-50/50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{JOB_LABELS[job] ?? job}</p>
                    <p className="text-xs text-gray-500">
                      {cfg
                        ? `Serie: ${Array.isArray(cfg.serie) ? cfg.serie.join(", ") : "—"}`
                        : "Výchozí nastavení"}
                    </p>
                  </div>
                  <span className="text-sm text-amber-600">Upravit →</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Zaměstnanci (baliči)</h2>
          <p className="mb-4 text-sm text-gray-500">
            Seznam baličů pro protokoly. Správa zaměstnanců bude dostupná v další fázi.
          </p>
          {initialEmployees.length > 0 ? (
            <ul className="space-y-1">
              {initialEmployees.map((e) => (
                <li key={e.id} className="text-sm text-gray-700">
                  {e.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Žádní zaměstnanci zatím nejsou zadaní.</p>
          )}
        </div>
      </div>
    </>
  );
}

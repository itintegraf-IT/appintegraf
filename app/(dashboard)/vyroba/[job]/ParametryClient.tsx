"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileOutput, Package, Save } from "lucide-react";
import { JOB_LABELS, JOB_TYPES, FIX_SETTINGS } from "@/lib/vyroba/config/fix-settings";

type JobType = (typeof JOB_TYPES)[number];

type Config = {
  serie: string[];
  pocetCnaRoli: number | null;
  ksVKr: number;
  prvniRole: number;
  prvniJizd: number;
  prod: number;
  skip?: number | null;
  predcisli?: string[] | null;
  cisloZakazky?: string | null;
};

type Props = {
  job: string;
  canWrite: boolean;
  initialAddress: string;
  initialConfig: Config | null;
};

export default function ParametryClient({
  job,
  canWrite,
  initialAddress,
  initialConfig,
}: Props) {
  const router = useRouter();
  const fix = FIX_SETTINGS[job];
  const isCDPOP = job === "CD_POP";
  const isDPB = job === "DPB_AVJ";
  const isIGT = job === "IGT_Sazka";

  const [address, setAddress] = useState(initialAddress);
  const [serie, setSerie] = useState(
    initialConfig?.serie?.join(",") ?? "XB,XC,XD,XE,XF,XG"
  );
  const defaultPocetCnaRoli =
    initialConfig?.pocetCnaRoli ??
    (isCDPOP ? 180 : fix?.cisNaRoli === "x" ? "" : typeof fix?.cisNaRoli === "number" ? fix.cisNaRoli : "");
  const [pocetCnaRoli, setPocetCnaRoli] = useState(String(defaultPocetCnaRoli));
  const [ksVKr, setKsVKr] = useState(String(initialConfig?.ksVKr ?? 20));
  const [prvniJizd, setPrvniJizd] = useState(
    String(initialConfig?.prvniJizd ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  );
  const [prod, setProd] = useState(String(initialConfig?.prod ?? 6));
  const [skip, setSkip] = useState(String(initialConfig?.skip ?? 0));
  const [cisloZakazky, setCisloZakazky] = useState(initialConfig?.cisloZakazky ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const label = JOB_LABELS[job] ?? job;
  const pocCislic = fix?.pocCislic ?? 6;
  const vzdalCislovacu = 4;

  const handleSave = async () => {
    if (!canWrite) return;
    setSaving(true);
    setMessage(null);
    try {
      const serieArr = serie.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await fetch(`/api/vyroba/jobs/${job}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serie: serieArr.length ? serieArr : ["XB", "XC", "XD", "XE", "XF", "XG"],
          pocetCnaRoli: pocetCnaRoli ? parseInt(pocetCnaRoli, 10) : null,
          ksVKr: parseInt(ksVKr, 10) || 20,
          prvniJizd: parseInt(prvniJizd.replace(/\s/g, ""), 10) || 0,
          prod: parseInt(prod, 10) || 6,
          skip: skip ? parseInt(skip, 10) : null,
          cisloZakazky: cisloZakazky.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Chyba");
      }
      const addrRes = await fetch("/api/vyroba/address", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!addrRes.ok) throw new Error("Chyba při ukládání adresy");
      setMessage("Parametry uloženy");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Chyba");
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

      <div
        className="rounded-xl border-2 p-6 text-white"
        style={{
          background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
          borderColor: "rgba(255,255,255,0.3)",
        }}
      >
        <h1 className="mb-6 text-xl font-bold">ROLE – {label}</h1>

        <div className="space-y-4 rounded-lg border border-white/30 bg-white/10 p-4 backdrop-blur">
          <h2 className="text-sm font-semibold uppercase tracking-wider">
            PARAMETRY
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs text-white/80">Job</label>
              <select
                value={job}
                onChange={(e) => router.push(`/vyroba/${e.target.value}`)}
                className="mt-1 w-full rounded bg-white px-3 py-2 font-mono text-sm text-gray-900"
              >
                {JOB_TYPES.map((j) => (
                  <option key={j} value={j}>
                    {JOB_LABELS[j] ?? j}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/80">Serie</label>
              <input
                type="text"
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                disabled={!canWrite}
                placeholder="XB,XC,XD,XE,XF,XG"
                className="mt-1 w-full rounded bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs text-white/80">
                Vzdál. číslovačů [inch]
              </label>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded bg-white/20 px-3 py-2 font-mono">
                  {vzdalCislovacu}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/80">
                Počet čísel v roli
              </label>
              <input
                type="text"
                value={pocetCnaRoli}
                onChange={(e) => setPocetCnaRoli(e.target.value)}
                disabled={!canWrite && !isCDPOP}
                placeholder={isCDPOP ? "180" : ""}
                className="mt-1 w-full rounded bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs text-white/80">
                Číslo první jízdenky
              </label>
              <input
                type="text"
                value={prvniJizd}
                onChange={(e) =>
                  setPrvniJizd(
                    e.target.value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ")
                  )
                }
                disabled={!canWrite}
                placeholder="997920"
                className="mt-1 w-full rounded bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs text-white/80">Počet číslic</label>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded bg-white/20 px-3 py-2 font-mono">
                  {pocCislic}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/80">
                Počet produkcí
              </label>
              <input
                type="number"
                min="1"
                max="32"
                value={prod}
                onChange={(e) => setProd(e.target.value)}
                disabled={!canWrite}
                className="mt-1 w-full rounded bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs text-white/80">
                Počet rolí v krabici
              </label>
              <input
                type="number"
                min="1"
                value={ksVKr}
                onChange={(e) => setKsVKr(e.target.value)}
                disabled={!canWrite}
                className="mt-1 w-full rounded bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60"
              />
            </div>
            {isDPB && (
              <div>
                <label className="block text-xs text-white/80">
                  Skip mezi produkc.
                </label>
                <input
                  type="number"
                  value={skip}
                  onChange={(e) => setSkip(e.target.value)}
                  disabled={!canWrite}
                  className="mt-1 w-full rounded bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60"
                />
              </div>
            )}
            {isIGT && (
              <div>
                <label className="block text-xs text-white/80">
                  Číslo zakázky
                </label>
                <input
                  type="text"
                  value={cisloZakazky}
                  onChange={(e) => setCisloZakazky(e.target.value.slice(0, 7))}
                  disabled={!canWrite}
                  placeholder="ABC1234"
                  maxLength={7}
                  className="mt-1 w-full rounded bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60"
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs text-white/80">
                Místo pro tisk. sestavy a výst. protokoly
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={!canWrite}
                  placeholder="D:\Sazka\A17144"
                  className="flex-1 rounded bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {canWrite && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Ukládám…" : "OK"}
            </button>
          )}
          {message && (
            <p className="mt-2 text-sm text-white/90">{message}</p>
          )}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-white/30 bg-white/10 p-4 backdrop-blur">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">
              ČÍSLOVÁNÍ
            </h2>
            <Link
              href={`/vyroba/generovani/${job}`}
              className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 font-medium text-teal-800 hover:bg-teal-50"
            >
              <FileOutput className="h-5 w-5" />
              TISK
            </Link>
            <p className="mt-2 text-xs text-white/80">
              Generování dat pro tiskárny
            </p>
          </div>

          <div className="rounded-lg border border-white/30 bg-white/10 p-4 backdrop-blur">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">
              ŘEZÁNÍ
            </h2>
            <Link
              href={`/vyroba/kontrola/${job}`}
              className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 font-medium text-teal-800 hover:bg-teal-50"
            >
              <Package className="h-5 w-5" />
              REZANI
            </Link>
            <p className="mt-2 text-xs text-white/80">
              Kontrola balení, výhoz, krabice
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

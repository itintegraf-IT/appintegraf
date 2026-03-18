"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { deleni3 } from "@/lib/vyroba/utils/deleni3";
import { FIX_SETTINGS } from "@/lib/vyroba/config/fix-settings";

type Row = {
  checked: boolean;
  serie: string;
  predcisli?: string;
  cisloOd: string;
  cisloDo: string;
  ks: number;
};

type Props = {
  job: string;
};

export default function KontrolaClient({ job }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<{
    ksVKr: number;
    vyhoz: number;
    hotKrab: number;
    pocetRoli: number;
    celkem: number;
    rows: Row[];
    cKrabNaPalete: number;
    paleta: number;
    cisloZakazky: string;
    employees: string[];
    stepBase: number;
  } | null>(null);
  const [balil, setBalil] = useState("Vyber jmeno...");
  const [tiskNaJehle, setTiskNaJehle] = useState(true);
  const [turbo, setTurbo] = useState(false);
  const [korekce, setKorekce] = useState(0);
  const [opravitMode, setOpravitMode] = useState(false);
  const [importing, setImporting] = useState(false);

  const fix = FIX_SETTINGS[job];
  const pocCislic = fix?.pocCislic ?? 6;
  const ciselNaRoli = fix?.cisNaRoli === "x" ? 180 : (fix?.cisNaRoli ?? 180);
  const isIGT = job === "IGT_Sazka";

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vyroba/boxes/${job}`);
      if (!res.ok) throw new Error("Chyba při načítání");
      const data = await res.json();
      setState({
        ksVKr: data.ksVKr,
        vyhoz: data.vyhoz,
        hotKrab: data.hotKrab,
        pocetRoli: data.pocetRoli,
        celkem: data.celkem,
        rows: data.rows,
        cKrabNaPalete: data.cKrabNaPalete,
        paleta: data.paleta,
        cisloZakazky: data.cisloZakazky,
        employees: data.employees ?? [],
        stepBase: data.stepBase ?? 1,
      });
      setBalil((prev) =>
        prev === "Vyber jmeno..." && data.employees?.length
          ? data.employees[0]
          : prev
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setLoading(false);
    }
  }, [job]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const formatCislo = (val: number) =>
    deleni3(String(val).padStart(pocCislic, "0"));

  const parseCislo = (s: string) => parseInt(s.replace(/\s/g, ""), 10) || 0;

  const posun = (direction: "zpet" | "vpred", step: number) => {
    if (!state) return;
    const stepBase = state.stepBase ?? 1;
    const delta = (direction === "zpet" ? step : -step) * stepBase;
    setState({
      ...state,
      rows: state.rows.map((r) => ({
        ...r,
        cisloOd: formatCislo(parseCislo(r.cisloOd) + delta),
        cisloDo: formatCislo(parseCislo(r.cisloDo) + delta),
      })),
    });
  };

  const plusMinus = (delta: number) => {
    if (!state) return;
    setKorekce((k) => k + delta);
    setState({
      ...state,
      rows: state.rows.map((r) => ({
        ...r,
        cisloDo: formatCislo(parseCislo(r.cisloDo) + delta),
      })),
    });
  };

  const toggleRow = (idx: number) => {
    if (!state) return;
    const rows = [...state.rows];
    rows[idx] = { ...rows[idx], checked: !rows[idx].checked };
    setState({ ...state, rows });
  };

  const updateRow = (idx: number, field: "cisloOd" | "cisloDo" | "ks", value: string | number) => {
    if (!state) return;
    const rows = [...state.rows];
    rows[idx] = { ...rows[idx], [field]: value };
    setState({ ...state, rows });
  };

  const handleOK = async () => {
    if (!state) return;
    if (balil === "Vyber jmeno...") {
      alert("Vyber jméno");
      return;
    }
    if (isIGT && !state.cisloZakazky.trim()) {
      alert("Zadej číslo zakázky");
      return;
    }
    try {
      const res = await fetch(`/api/vyroba/control/${job}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "vyhoz",
          balil,
          cisloZakazky: state.cisloZakazky,
          rows: state.rows,
          cKrabNaPalete: state.cKrabNaPalete,
          paleta: state.paleta,
          turbo,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Chyba");
      }
      const data = await res.json();
      if (data.protocolPdf) {
        const blob = new Blob(
          [Uint8Array.from(atob(data.protocolPdf), (c) => c.charCodeAt(0))],
          { type: "application/pdf" }
        );
        window.open(URL.createObjectURL(blob), "_blank");
      }
      await loadState();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Chyba");
    }
  };

  const updateCisloZakazky = (v: string) => {
    if (!state) return;
    setState({ ...state, cisloZakazky: v.slice(0, 7) });
  };

  const handleExportTxt = () => {
    window.open(`/api/vyroba/control/${job}/export-txt`, "_blank");
  };

  const handleProtokol = async () => {
    if (!state) return;
    try {
      const res = await fetch(`/api/vyroba/protocol/${job}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "both",
          balil,
          cKrabNaPalete: state.cKrabNaPalete,
          cisloKrabice: state.hotKrab + 1,
          hotKrab: state.hotKrab,
          rows: state.rows,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Chyba");
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Chyba protokolu");
    }
  };

  const handleSestava = async () => {
    if (!state || !isIGT) return;
    try {
      const boxes = [
        {
          cisloKrabice: String(state.hotKrab + 1).padStart(6, "0"),
          cisloPalety: String(state.paleta).padStart(2, "0"),
          serie: state.rows[0]?.serie ?? "",
          rows: state.rows,
        },
      ];
      const res = await fetch(`/api/vyroba/protocol/${job}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "igt-inkjety",
          cisloZakazky: state.cisloZakazky,
          cisloPalety: state.paleta,
          boxes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Chyba");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `inkjety_${state.cisloZakazky}.txt`;
      a.click();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Chyba sestavy");
    }
  };

  const handlePaleta = async () => {
    if (!state || !isIGT) return;
    try {
      const boxes = [
        {
          cisloKrabice: String(state.hotKrab + 1).padStart(6, "0"),
          cisloPalety: String(state.paleta).padStart(2, "0"),
          rows: state.rows,
        },
      ];
      const res = await fetch(`/api/vyroba/protocol/${job}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "igt-paleta",
          cisloZakazky: state.cisloZakazky,
          cisloPalety: state.paleta,
          boxes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Chyba");
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Chyba palety");
    }
  };

  const handleImportTxt = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        const content = await file.text();
        const res = await fetch(`/api/vyroba/control/${job}/import-txt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Chyba");
        await loadState();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Chyba při importu");
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  const handleOpravit = async () => {
    if (!state) return;
    try {
      const res = await fetch(`/api/vyroba/control/${job}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "opravit",
          rows: state.rows.map((r) => ({
            cisloOd: r.cisloOd,
            cisloDo: r.cisloDo,
            ks: r.ks,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Chyba");
      setOpravitMode(false);
      await loadState();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Chyba");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-gray-500">Načítám…</p>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-red-700">{error ?? "Chyba"}</p>
        <button
          onClick={loadState}
          className="mt-2 text-sm text-red-600 hover:underline"
        >
          Zkusit znovu
        </button>
      </div>
    );
  }

  const korekceOutOfRange = korekce < -3 || korekce > 3;

  return (
    <>
      <div className="mb-4 flex items-center gap-4">
        <Link
          href={`/vyroba/${job}`}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět na parametry
        </Link>
      </div>

      <div
        className="rounded-xl border-2 p-6"
        style={{
          background: "linear-gradient(135deg, #009fda 0%, #0081d2 100%)",
          borderColor: "rgba(255,255,255,0.3)",
        }}
      >
        <h1 className="mb-6 text-xl font-bold text-white">ROLE – {job}</h1>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm text-white sm:grid-cols-4">
          <div>
            <span className="opacity-80">V krabici:</span>{" "}
            <span className="font-semibold">{state.ksVKr} ks</span>
          </div>
          <div>
            <span className="opacity-80">Výhoz:</span>{" "}
            <span className="font-semibold">{state.vyhoz}</span>
          </div>
          <div>
            <span className="opacity-80">Hot. krab.:</span>{" "}
            <span className="font-semibold">{state.hotKrab}</span>
          </div>
          <div>
            <span className="opacity-80">Počet rolí:</span>{" "}
            <span className="font-semibold">{state.pocetRoli}</span>
          </div>
          <div>
            <span className="opacity-80">Celkem:</span>{" "}
            <span className="font-semibold">{state.celkem}</span>
          </div>
        </div>

        <div className="mb-6 overflow-x-auto rounded-lg border border-white/30 bg-[#ffffc2]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-100/80">
                <th className="w-10 p-2"></th>
                <th className="p-2 text-left">Série</th>
                {isIGT && <th className="p-2 text-left">Prefix</th>}
                <th className="p-2 text-left">Od</th>
                <th className="p-2 text-left">Do</th>
                <th className="w-16 p-2"></th>
                <th className="p-2 text-left">ks</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-200 ${
                    !row.checked ? "bg-blue-100/50 text-blue-700" : ""
                  }`}
                >
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={() => toggleRow(idx)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="p-2 font-mono">{row.serie}</td>
                  {isIGT && (
                    <td className="p-2 font-mono">{row.predcisli ?? ""}</td>
                  )}
                  <td className="p-2 font-mono">
                    {opravitMode ? (
                      <input
                        type="text"
                        value={row.cisloOd}
                        onChange={(e) => updateRow(idx, "cisloOd", e.target.value)}
                        className="w-24 rounded border border-gray-300 px-1 py-0.5 text-sm"
                      />
                    ) : (
                      row.cisloOd
                    )}
                  </td>
                  <td className="p-2 font-mono">
                    {opravitMode ? (
                      <input
                        type="text"
                        value={row.cisloDo}
                        onChange={(e) => updateRow(idx, "cisloDo", e.target.value)}
                        className={`w-24 rounded border border-gray-300 px-1 py-0.5 text-sm ${korekceOutOfRange && row.checked ? "border-red-500" : ""}`}
                      />
                    ) : (
                      <span
                        className={
                          korekceOutOfRange && row.checked ? "text-red-600" : ""
                        }
                      >
                        {row.cisloDo}
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    {!opravitMode && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => plusMinus(-1)}
                          className="rounded bg-red-100 p-1 text-red-700 hover:bg-red-200"
                          title="Korekce -1"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => plusMinus(1)}
                          className="rounded bg-blue-100 p-1 text-blue-700 hover:bg-blue-200"
                          title="Korekce +1"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-2 font-mono">
                    {opravitMode ? (
                      <input
                        type="number"
                        min={0}
                        max={state.ksVKr}
                        value={row.ks}
                        onChange={(e) =>
                          updateRow(idx, "ks", parseInt(e.target.value, 10) || 0)
                        }
                        className="w-14 rounded border border-gray-300 px-1 py-0.5 text-sm"
                      />
                    ) : (
                      `${row.ks} ks`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isIGT && (
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm text-white/90">
                Počet krabic na paletě
              </label>
              <input
                type="number"
                value={state.cKrabNaPalete}
                readOnly
                className="mt-1 w-full max-w-[120px] rounded bg-[#ffffc2] px-2 py-1 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm text-white/90">
                Paleta číslo
              </label>
              <input
                type="number"
                value={state.paleta}
                readOnly
                className="mt-1 w-full max-w-[120px] rounded bg-[#ffffc2] px-2 py-1 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm text-white/90">
                Číslo zakázky
              </label>
              <input
                type="text"
                value={state.cisloZakazky}
                onChange={(e) => updateCisloZakazky(e.target.value)}
                maxLength={7}
                placeholder="ABC1234"
                className="mt-1 w-full max-w-[140px] rounded bg-white px-2 py-1 font-mono"
              />
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <button
            onClick={handleExportTxt}
            className="rounded bg-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30"
            title="Stáhnout stav jako TXT pro ruční opravu"
          >
            Export TXT
          </button>
          <button
            onClick={handleImportTxt}
            disabled={importing}
            className="rounded bg-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30 disabled:opacity-50"
            title="Načíst stav z TXT souboru (přepíše DB)"
          >
            {importing ? "Importuji…" : "Import TXT"}
          </button>
          {opravitMode ? (
            <>
              <button
                onClick={handleOpravit}
                className="rounded bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
              >
                Uložit opravu
              </button>
              <button
                onClick={() => setOpravitMode(false)}
                className="rounded bg-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30"
              >
                Zrušit
              </button>
            </>
          ) : (
            <button
              onClick={() => setOpravitMode(true)}
              className="rounded bg-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30"
              title="Ruční oprava čísel v gridu"
            >
              Opravit
            </button>
          )}
          {!isIGT && (
            <button
              onClick={handleProtokol}
              className="rounded bg-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30"
              title="Tisk protokolu (balný list + štítek) pro aktuální stav"
            >
              Protokol
            </button>
          )}
          <div className="flex items-center gap-2">
            <select
              value={balil}
              onChange={(e) => setBalil(e.target.value)}
              className="rounded bg-white px-3 py-1.5 text-sm"
            >
              <option value="Vyber jmeno...">Vyber jmeno...</option>
              {state.employees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={tiskNaJehle}
              onChange={(e) => setTiskNaJehle(e.target.checked)}
              className="h-4 w-4"
            />
            Tisk na jehle
          </label>
          {isIGT && (
            <>
              <button
                onClick={handleSestava}
                className="rounded bg-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30"
                title="TXT pro jehličkovou tiskárnu (inkjety)"
              >
                Sestava
              </button>
              <button
                onClick={handlePaleta}
                className="rounded bg-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30"
                title="Paletový list PDF"
              >
                Paleta
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => posun("zpet", 1000)}
            className="rounded bg-white/20 px-2 py-2 text-white hover:bg-white/30"
            title="Zpět o 1000"
          >
            ««
          </button>
          <button
            onClick={() => posun("zpet", 100)}
            className="rounded bg-white/20 px-2 py-2 text-white hover:bg-white/30"
            title="Zpět o 100"
          >
            «‹
          </button>
          <button
            onClick={() => posun("zpet", 10)}
            className="rounded bg-white/20 px-2 py-2 text-white hover:bg-white/30"
            title="Zpět o 10"
          >
            «
          </button>
          <button
            onClick={() => posun("zpet", 1)}
            className="rounded bg-white/20 px-2 py-2 text-white hover:bg-white/30"
            title="Zpět o 1"
          >
            ‹
          </button>
          <button
            onClick={handleOK}
            className="mx-2 rounded-lg bg-white px-6 py-3 font-bold text-[#009fda] hover:bg-gray-100"
          >
            OK
          </button>
          <button
            onClick={() => posun("vpred", 1)}
            className="rounded bg-white/20 px-2 py-2 text-white hover:bg-white/30"
            title="Vpřed o 1"
          >
            ›
          </button>
          <button
            onClick={() => posun("vpred", 10)}
            className="rounded bg-white/20 px-2 py-2 text-white hover:bg-white/30"
            title="Vpřed o 10"
          >
            »
          </button>
          <button
            onClick={() => posun("vpred", 100)}
            className="rounded bg-white/20 px-2 py-2 text-white hover:bg-white/30"
            title="Vpřed o 100"
          >
            »›
          </button>
          <button
            onClick={() => posun("vpred", 1000)}
            className="rounded bg-white/20 px-2 py-2 text-white hover:bg-white/30"
            title="Vpřed o 1000"
          >
            »»
          </button>
          <label className="ml-4 flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={turbo}
              onChange={(e) => setTurbo(e.target.checked)}
              className="h-4 w-4"
            />
            Turbo
          </label>
        </div>
      </div>
    </>
  );
}

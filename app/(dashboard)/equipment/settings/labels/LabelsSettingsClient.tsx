"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  DEFAULT_EQUIPMENT_LABEL_TEMPLATE,
  PAPER_SAFE_MARGIN_MM,
  getTemplateSpec,
  labelGridFitError,
  labelsPerPage,
  type EquipmentLabelGridSpec,
  type EquipmentLabelTemplateKey,
} from "@/lib/equipment/label-layout";

type TemplateOpt = {
  key: EquipmentLabelTemplateKey;
  label: string;
  labelsPerPage: number;
  spec: EquipmentLabelGridSpec;
};

type ApiResponse = {
  settings: {
    templateKey: EquipmentLabelTemplateKey;
    useCustom: boolean;
    customSpec: EquipmentLabelGridSpec;
  };
  templates: TemplateOpt[];
  labelsPerPage?: number;
  error?: string;
};

const emptySpec: EquipmentLabelGridSpec = getTemplateSpec(DEFAULT_EQUIPMENT_LABEL_TEMPLATE);

function GridPreview({ spec }: { spec: EquipmentLabelGridSpec }) {
  const scale = 1.1;
  const pageW = A4_WIDTH_MM * scale;
  const pageH = A4_HEIGHT_MM * scale;
  const cells = useMemo(() => {
    const out: { left: number; top: number; w: number; h: number }[] = [];
    for (let row = 0; row < spec.rows; row++) {
      for (let col = 0; col < spec.cols; col++) {
        out.push({
          left: (spec.marginLeftMm + col * (spec.labelWidthMm + spec.colGapMm)) * scale,
          top: (spec.marginTopMm + row * (spec.labelHeightMm + spec.rowGapMm)) * scale,
          w: spec.labelWidthMm * scale,
          h: spec.labelHeightMm * scale,
        });
      }
    }
    return out;
  }, [spec, scale]);

  return (
    <div
      className="relative mx-auto border border-gray-300 bg-white shadow-sm"
      style={{ width: pageW, height: pageH }}
      aria-hidden
    >
      {cells.map((c, i) => (
        <div
          key={i}
          className="absolute border border-red-300 bg-red-50/60"
          style={{ left: c.left, top: c.top, width: c.w, height: c.h }}
        />
      ))}
      <div
        className="pointer-events-none absolute border border-dashed border-gray-400"
        style={{
          left: PAPER_SAFE_MARGIN_MM * scale,
          top: PAPER_SAFE_MARGIN_MM * scale,
          width: (A4_WIDTH_MM - 2 * PAPER_SAFE_MARGIN_MM) * scale,
          height: (A4_HEIGHT_MM - 2 * PAPER_SAFE_MARGIN_MM) * scale,
        }}
      />
    </div>
  );
}

export default function LabelsSettingsClient() {
  const [templates, setTemplates] = useState<TemplateOpt[]>([]);
  const [templateKey, setTemplateKey] = useState<EquipmentLabelTemplateKey>(DEFAULT_EQUIPMENT_LABEL_TEMPLATE);
  const [useCustom, setUseCustom] = useState(false);
  const [spec, setSpec] = useState<EquipmentLabelGridSpec>(emptySpec);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/equipment/settings/label-grid");
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok) {
        setError(data.error ?? "Chyba načtení");
        return;
      }
      setTemplates(data.templates ?? []);
      setTemplateKey(data.settings.templateKey);
      setUseCustom(data.settings.useCustom);
      setSpec(data.settings.customSpec);
    } catch {
      setError("Chyba načtení");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const previewSpec = useMemo(() => {
    if (useCustom) return spec;
    return templates.find((t) => t.key === templateKey)?.spec ?? spec;
  }, [useCustom, spec, templates, templateKey]);
  const fitError = labelGridFitError(previewSpec);

  const applyTemplateToCustom = (key: EquipmentLabelTemplateKey) => {
    const t = templates.find((x) => x.key === key);
    if (t) setSpec({ ...t.spec });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setOkMsg("");
    try {
      const res = await fetch("/api/equipment/settings/label-grid", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey,
          useCustom,
          customSpec: spec,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok) {
        setError(data.error ?? "Chyba uložení");
        return;
      }
      setOkMsg(
        `Uloženo. Na stránku se vejde ${labelsPerPage(previewSpec)} štítků (výchozí pro hromadný tisk).`
      );
      if (data.settings) {
        setTemplateKey(data.settings.templateKey);
        setUseCustom(data.settings.useCustom);
        setSpec(data.settings.customSpec);
      }
    } catch {
      setError("Chyba uložení");
    } finally {
      setSaving(false);
    }
  };

  const setNum = (key: keyof EquipmentLabelGridSpec, value: string) => {
    const n = parseFloat(value);
    setSpec((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : prev[key] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Štítky / mřížka A4</h1>
          <p className="mt-1 text-gray-600">
            Rozložení QR štítků na arch A4 — jeden formát pro majetek i místnosti
          </p>
        </div>
        <Link href="/equipment/settings" className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
          Zpět
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {okMsg ? <p className="text-sm text-green-700">{okMsg}</p> : null}
      {loading ? <p className="text-sm text-gray-500">Načítání…</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Výchozí šablona</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={templateKey}
              onChange={(e) => {
                const key = e.target.value as EquipmentLabelTemplateKey;
                setTemplateKey(key);
                if (!useCustom) applyTemplateToCustom(key);
              }}
            >
              {templates.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label} · {t.labelsPerPage}/stránku
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => {
                setUseCustom(e.target.checked);
                if (e.target.checked) applyTemplateToCustom(templateKey);
              }}
            />
            Použít vlastní rozměry (mm) místo vestavěné šablony
          </label>

          <div className={`grid gap-3 sm:grid-cols-2 ${useCustom ? "" : "opacity-50"}`}>
            {(
              [
                ["cols", "Sloupce"],
                ["rows", "Řádky"],
                ["labelWidthMm", "Šířka štítku (mm)"],
                ["labelHeightMm", "Výška štítku (mm)"],
                ["marginTopMm", "Horní okraj (mm)"],
                ["marginLeftMm", "Levý okraj (mm)"],
                ["colGapMm", "Mezera sloupců (mm)"],
                ["rowGapMm", "Mezera řádků (mm)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="mb-1 block text-gray-600">{label}</span>
                <input
                  type="number"
                  step={key === "cols" || key === "rows" ? 1 : 0.5}
                  disabled={!useCustom}
                  className="w-full rounded-lg border px-3 py-2"
                  value={spec[key]}
                  onChange={(e) => setNum(key, e.target.value)}
                />
              </label>
            ))}
          </div>

          {fitError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {fitError}
            </p>
          ) : null}
          <p className="text-sm text-gray-600">
            Obsah štítku drží odstup {PAPER_SAFE_MARGIN_MM} mm od okraje papíru (čárkovaně v náhledu), aby ho tiskárna
            neořízla.
          </p>
          <p className="text-sm text-gray-600">
            Na stránku: <strong>{labelsPerPage(previewSpec)}</strong> štítků (
            {previewSpec.cols}×{previewSpec.rows}, {previewSpec.labelWidthMm}×
            {previewSpec.labelHeightMm} mm)
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || Boolean(fitError)}
              onClick={() => void save()}
              className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {saving ? "Ukládám…" : "Uložit"}
            </button>
            <button
              type="button"
              className="rounded-lg border px-4 py-2 text-sm"
              onClick={() => {
                setUseCustom(false);
                applyTemplateToCustom(templateKey);
              }}
            >
              Obnovit ze šablony
            </button>
            <Link
              href="/equipment/rooms"
              className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Zpět na místnosti
            </Link>
          </div>
        </div>

        <div className="rounded-xl border bg-gray-50 p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">Náhled A4</h2>
          <div className="overflow-auto">
            <GridPreview spec={previewSpec} />
          </div>
        </div>
      </div>
    </div>
  );
}

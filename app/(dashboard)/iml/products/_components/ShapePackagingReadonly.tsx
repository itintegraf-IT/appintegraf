"use client";

import { useEffect, useState } from "react";
import { shapePackagingMaterialLabel } from "@/lib/iml/die-cut-constants";

type PackagingRow = {
  id: number;
  material_code: string;
  weight_per_thousand: string | number;
  pcs_per_box: number;
  pcs_per_pallet: number;
  box_type: string | null;
};

type BoxTypeOpt = { code: string; name: string };

type Props = {
  shapeId: string;
  /** Kód fólie / papíru pro zvýraznění aktivního řádku (volitelné). */
  highlightCodes?: string[];
};

function norm(s: string): string {
  return s.trim().toUpperCase().replace(/[\s_-]+/g, "");
}

export function ShapePackagingReadonly({ shapeId, highlightCodes = [] }: Props) {
  const [rows, setRows] = useState<PackagingRow[]>([]);
  const [boxTypes, setBoxTypes] = useState<BoxTypeOpt[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = parseInt(shapeId, 10);
    if (!Number.isFinite(id) || id < 1) {
      setRows([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [packRes, boxRes] = await Promise.all([
        fetch(`/api/iml/shapes/${id}/packaging`),
        fetch("/api/iml/box-types"),
      ]);
      const packData = await packRes.json().catch(() => ({}));
      const boxData = await boxRes.json().catch(() => ({}));
      if (cancelled) return;
      if (!packRes.ok) {
        setError(packData.error ?? "Nelze načíst matici");
        setRows([]);
        return;
      }
      setError(null);
      setRows(packData.packaging ?? []);
      setBoxTypes(
        Array.isArray(boxData.box_types)
          ? boxData.box_types.map((b: BoxTypeOpt) => ({
              code: b.code,
              name: b.name,
            }))
          : []
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [shapeId]);

  if (!shapeId) return null;

  const hl = highlightCodes.map(norm).filter(Boolean);

  const boxTypeLabel = (code: string | null) => {
    if (!code) return "—";
    const found = boxTypes.find((b) => b.code === code);
    return found ? `${found.code} — ${found.name}` : code;
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <h4 className="mb-1 text-sm font-semibold text-gray-800">
        Materiálová a balicí matice tvaru
      </h4>
      <p className="mb-2 text-xs text-gray-500">
        Údaje patří k tvaru (ne k produktu). Úpravy: IML → Tvary → matice u vybraného tvaru.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!error && rows.length === 0 && (
        <p className="text-xs text-gray-500">Pro tento tvar zatím není matice vyplněná.</p>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="px-2 py-1">Materiál</th>
                <th className="px-2 py-1">g / 1000 ks</th>
                <th className="px-2 py-1">ks / krabice</th>
                <th className="px-2 py-1">ks / paleta</th>
                <th className="px-2 py-1">Krabice</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const active =
                  hl.length > 0 &&
                  hl.some(
                    (c) =>
                      c === norm(r.material_code) ||
                      c.includes(norm(r.material_code)) ||
                      norm(r.material_code).includes(c)
                  );
                return (
                  <tr
                    key={r.id}
                    className={
                      active
                        ? "bg-violet-100 font-medium text-violet-900"
                        : "border-t border-gray-100"
                    }
                  >
                    <td className="px-2 py-1">{shapePackagingMaterialLabel(r.material_code)}</td>
                    <td className="px-2 py-1">{Number(r.weight_per_thousand)}</td>
                    <td className="px-2 py-1">{r.pcs_per_box}</td>
                    <td className="px-2 py-1">{r.pcs_per_pallet}</td>
                    <td className="px-2 py-1">{boxTypeLabel(r.box_type)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

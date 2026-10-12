"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SHAPE_PACKAGING_MATERIALS,
  shapePackagingMaterialLabel,
} from "@/lib/iml/die-cut-constants";

type CustomerOpt = { id: number; name: string };
type BoxTypeOpt = { id: number; code: string; name: string };
type PackagingRow = {
  id: number;
  material_code: string;
  weight_per_thousand: string | number;
  pcs_per_box: number;
  pcs_per_pallet: number;
  box_type: string | null;
};

const emptyPack = {
  material_code: "",
  weight_per_thousand: "",
  pcs_per_box: "",
  pcs_per_pallet: "",
  box_type: "",
};

type Props = {
  shapeId: number;
  shapeCode: string;
  onError: (msg: string) => void;
};

export function ShapeExtrasPanel({ shapeId, shapeCode, onError }: Props) {
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [boxTypes, setBoxTypes] = useState<BoxTypeOpt[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [packaging, setPackaging] = useState<PackagingRow[]>([]);
  const [packForm, setPackForm] = useState(emptyPack);
  const [editingPackId, setEditingPackId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [customerQ, setCustomerQ] = useState("");

  const load = useCallback(async () => {
    const [custRes, packRes, allCustRes, boxRes] = await Promise.all([
      fetch(`/api/iml/shapes/${shapeId}/customers`),
      fetch(`/api/iml/shapes/${shapeId}/packaging`),
      fetch("/api/iml/customers?scope=units"),
      fetch("/api/iml/box-types"),
    ]);
    const custData = await custRes.json().catch(() => ({}));
    const packData = await packRes.json().catch(() => ({}));
    const allCustData = await allCustRes.json().catch(() => ({}));
    const boxData = await boxRes.json().catch(() => ({}));
    if (!custRes.ok) {
      onError(custData.error ?? "Nelze načíst zákazníky tvaru");
      return;
    }
    if (!packRes.ok) {
      onError(packData.error ?? "Nelze načíst matici");
      return;
    }
    setSelectedIds((custData.customers ?? []).map((c: CustomerOpt) => c.id));
    setPackaging(packData.packaging ?? []);
    setBoxTypes(
      Array.isArray(boxData.box_types)
        ? boxData.box_types.map((b: BoxTypeOpt) => ({
            id: b.id,
            code: b.code,
            name: b.name,
          }))
        : []
    );
    const list = Array.isArray(allCustData.customers)
      ? allCustData.customers
      : Array.isArray(allCustData)
        ? allCustData
        : [];
    setCustomers(
      list.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name }))
    );
  }, [shapeId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const usedMaterialCodes = useMemo(() => {
    const used = new Set(
      packaging
        .filter((p) => editingPackId == null || p.id !== editingPackId)
        .map((p) => p.material_code.toUpperCase())
    );
    return used;
  }, [packaging, editingPackId]);

  const materialOptions = useMemo(() => {
    return SHAPE_PACKAGING_MATERIALS.filter(
      (m) =>
        !usedMaterialCodes.has(m.code.toUpperCase()) ||
        packForm.material_code.toUpperCase() === m.code.toUpperCase()
    );
  }, [usedMaterialCodes, packForm.material_code]);

  const saveCustomers = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/iml/shapes/${shapeId}/customers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_ids: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error ?? "Uložení zákazníků selhalo");
        return;
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleCustomer = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const onMaterialChange = (code: string) => {
    setPackForm((f) => ({
      ...f,
      material_code: code,
      // Při novém výběru nechte hmotnost k vyplnění (jako u legacy výseků).
      weight_per_thousand: code !== f.material_code ? "" : f.weight_per_thousand,
    }));
  };

  const savePackaging = async () => {
    if (!packForm.material_code) {
      onError("Vyberte materiál ze seznamu.");
      return;
    }
    if (!packForm.weight_per_thousand.trim()) {
      onError(
        `U materiálu ${shapePackagingMaterialLabel(packForm.material_code)} je povinná hmotnost.`
      );
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...(editingPackId != null ? { id: editingPackId } : {}),
        material_code: packForm.material_code,
        weight_per_thousand: packForm.weight_per_thousand,
        pcs_per_box: packForm.pcs_per_box || 0,
        pcs_per_pallet: packForm.pcs_per_pallet || 0,
        box_type: packForm.box_type || null,
      };
      const res = await fetch(`/api/iml/shapes/${shapeId}/packaging`, {
        method: editingPackId != null ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error ?? "Uložení matice selhalo");
        return;
      }
      setPackForm(emptyPack);
      setEditingPackId(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const removePackaging = async (id: number) => {
    if (!confirm("Smazat řádek matice?")) return;
    const res = await fetch(`/api/iml/shapes/${shapeId}/packaging?id=${id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      onError(data.error ?? "Smazání selhalo");
      return;
    }
    await load();
  };

  const filteredCustomers = customers.filter((c) => {
    if (!customerQ.trim()) return true;
    return c.name.toLowerCase().includes(customerQ.trim().toLowerCase());
  });

  const boxTypeLabel = (code: string | null) => {
    if (!code) return "—";
    const found = boxTypes.find((b) => b.code === code);
    return found ? `${found.code} — ${found.name}` : code;
  };

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
      <p className="text-xs font-medium text-violet-900">
        Detail tvaru {shapeCode}: zákazníci a materiálová matice
      </p>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-gray-600">
          Zákazníci (nepovinné)
        </h4>
        <input
          className="mb-2 w-full max-w-xs rounded border border-gray-300 px-2 py-1 text-xs"
          placeholder="Filtrovat zákazníky…"
          value={customerQ}
          onChange={(e) => setCustomerQ(e.target.value)}
        />
        <div className="max-h-36 space-y-1 overflow-y-auto rounded border border-gray-200 bg-white p-2">
          {filteredCustomers.length === 0 && (
            <p className="text-xs text-gray-500">Žádní zákazníci</p>
          )}
          {filteredCustomers.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={selectedIds.includes(c.id)}
                onChange={() => toggleCustomer(c.id)}
              />
              {c.name}
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveCustomers()}
          className="mt-2 rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          Uložit zákazníky
        </button>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-gray-600">
          Materiálová a balicí matice
        </h4>
        <p className="mb-2 text-xs text-gray-500">
          Materiál a typ krabice vybírejte z číselníku (stejný seznam jako u legacy výseků).
        </p>
        <div className="mb-2 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="pr-2">Materiál</th>
                <th className="pr-2">g/1000 ks</th>
                <th className="pr-2">ks/krabice</th>
                <th className="pr-2">ks/paleta</th>
                <th className="pr-2">Krabice</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {packaging.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="py-1 pr-2 font-medium">
                    {shapePackagingMaterialLabel(p.material_code)}
                  </td>
                  <td className="py-1 pr-2">{Number(p.weight_per_thousand)}</td>
                  <td className="py-1 pr-2">{p.pcs_per_box}</td>
                  <td className="py-1 pr-2">{p.pcs_per_pallet}</td>
                  <td className="py-1 pr-2">{boxTypeLabel(p.box_type)}</td>
                  <td className="py-1 whitespace-nowrap">
                    <button
                      type="button"
                      className="mr-2 text-violet-700 hover:underline"
                      onClick={() => {
                        setEditingPackId(p.id);
                        setPackForm({
                          material_code: p.material_code,
                          weight_per_thousand: String(p.weight_per_thousand),
                          pcs_per_box: String(p.pcs_per_box || ""),
                          pcs_per_pallet: String(p.pcs_per_pallet || ""),
                          box_type: p.box_type ?? "",
                        });
                      }}
                    >
                      Upravit
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => void removePackaging(p.id)}
                    >
                      Smazat
                    </button>
                  </td>
                </tr>
              ))}
              {packaging.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-2 text-gray-500">
                    Zatím žádné řádky
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs">
            <span className="mb-0.5 block text-gray-600">Materiál</span>
            <select
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
              value={packForm.material_code}
              onChange={(e) => onMaterialChange(e.target.value)}
            >
              <option value="">— Vyberte —</option>
              {materialOptions.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block text-gray-600">Hmotnost (g/1000 ks)</span>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
              placeholder="Hmotnost"
              value={packForm.weight_per_thousand}
              onChange={(e) =>
                setPackForm((f) => ({ ...f, weight_per_thousand: e.target.value }))
              }
              disabled={!packForm.material_code}
            />
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block text-gray-600">ks / krabice</span>
            <input
              type="number"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
              placeholder="ks/krabice"
              value={packForm.pcs_per_box}
              onChange={(e) =>
                setPackForm((f) => ({ ...f, pcs_per_box: e.target.value }))
              }
            />
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block text-gray-600">ks / paleta</span>
            <input
              type="number"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
              placeholder="ks/paleta"
              value={packForm.pcs_per_pallet}
              onChange={(e) =>
                setPackForm((f) => ({ ...f, pcs_per_pallet: e.target.value }))
              }
            />
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block text-gray-600">Typ krabice</span>
            <select
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
              value={packForm.box_type}
              onChange={(e) => setPackForm((f) => ({ ...f, box_type: e.target.value }))}
            >
              <option value="">— Vyberte —</option>
              {boxTypes.map((b) => (
                <option key={b.id} value={b.code}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void savePackaging()}
            className="rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {editingPackId != null ? "Uložit řádek" : "Přidat řádek"}
          </button>
          {editingPackId != null && (
            <button
              type="button"
              className="rounded border px-3 py-1 text-xs"
              onClick={() => {
                setEditingPackId(null);
                setPackForm(emptyPack);
              }}
            >
              Zrušit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

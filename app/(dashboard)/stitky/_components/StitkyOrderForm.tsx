"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_LABEL_ROWS, isStitkyTemplateReady, type StitkyOrderStatus } from "@/lib/stitky/constants";

export type TemplateOption = {
  key: string;
  layout_status: string;
};

export type LabelRowForm = {
  rowIndex: number;
  quantity: string;
  packSize: string;
  text1: string;
  text2: string;
  text3: string;
  prefix: string;
  rangeFrom: string;
  rangeTo: string;
  barcodeType: string;
};

export type OrderFormInitial = {
  orderNumber: string;
  templateKey: string;
  notes: string;
  rows: LabelRowForm[];
};

function emptyRow(index: number): LabelRowForm {
  return {
    rowIndex: index,
    quantity: "",
    packSize: "",
    text1: "",
    text2: "",
    text3: "",
    prefix: "",
    rangeFrom: "",
    rangeTo: "",
    barcodeType: "",
  };
}

function defaultRows(): LabelRowForm[] {
  return Array.from({ length: MAX_LABEL_ROWS }, (_, i) => emptyRow(i + 1));
}

type Props = {
  templates: TemplateOption[];
  initial?: OrderFormInitial;
  orderId?: number;
  canWrite: boolean;
  orderStatus?: StitkyOrderStatus;
};

export function StitkyOrderForm({ templates, initial, orderId, canWrite, orderStatus }: Props) {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState(initial?.orderNumber ?? "");
  const [templateKey, setTemplateKey] = useState(initial?.templateKey ?? templates[0]?.key ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [rows, setRows] = useState<LabelRowForm[]>(initial?.rows ?? defaultRows());
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const selectedTemplate = templates.find((t) => t.key === templateKey);
  const templateReady = selectedTemplate ? isStitkyTemplateReady(selectedTemplate.layout_status) : true;
  const canSubmitToProduction = !orderStatus || orderStatus === "DRAFT";

  const updateRow = (index: number, field: keyof LabelRowForm, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.rowIndex === index ? { ...r, [field]: value } : r))
    );
  };

  const payload = () => ({
    orderNumber,
    templateKey,
    notes,
    rows: rows.map((r) => ({
      rowIndex: r.rowIndex,
      quantity: r.quantity ? Number(r.quantity) : null,
      packSize: r.packSize ? Number(r.packSize) : null,
      text1: r.text1 || null,
      text2: r.text2 || null,
      text3: r.text3 || null,
      prefix: r.prefix || null,
      rangeFrom: r.rangeFrom || null,
      rangeTo: r.rangeTo || null,
      barcodeType: r.barcodeType || null,
    })),
  });

  const save = async () => {
    setSaving(true);
    setErrors([]);
    setActionMsg(null);
    try {
      const url = orderId ? `/api/stitky/orders/${orderId}` : "/api/stitky/orders";
      const method = orderId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? [data.error ?? "Uložení selhalo"]);
        return;
      }
      if (!orderId && data.order?.id) {
        router.push(`/stitky/${data.order.id}`);
        router.refresh();
      } else {
        setActionMsg("Uloženo");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (path: string, label: string) => {
    if (!orderId) return;
    setSaving(true);
    setErrors([]);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/stitky/orders/${orderId}${path}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? [data.error ?? `${label} selhalo`]);
        return;
      }
      setActionMsg(label + " — hotovo");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">Chyby validace:</p>
          <ul className="mt-2 list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {actionMsg && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {actionMsg}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Č. zakázky</label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            disabled={!canWrite || Boolean(orderId)}
            placeholder="A17984"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Šablona štítku</label>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value)}
            disabled={!canWrite}
          >
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.key}
                {t.layout_status !== "ready" ? " (připravuje se)" : ""}
              </option>
            ))}
          </select>
          {!templateReady && (
            <p className="mt-1 text-xs text-amber-700">
              Layout této šablony se připravuje — zakázku lze uložit jako rozpracovanou, ale zadání do výroby a tisk
              zatím nejsou k dispozici.
            </p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Množství</th>
              <th className="px-3 py-2">Balit po</th>
              <th className="px-3 py-2">Text 1</th>
              <th className="px-3 py-2">Text 2</th>
              <th className="px-3 py-2">Text 3</th>
              <th className="px-3 py-2">Prefix</th>
              <th className="px-3 py-2">Od</th>
              <th className="px-3 py-2">Do</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowIndex} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium">{row.rowIndex}.</td>
                {(["quantity", "packSize", "text1", "text2", "text3", "prefix", "rangeFrom", "rangeTo"] as const).map(
                  (field) => (
                    <td key={field} className="px-3 py-2">
                      <input
                        className="w-full min-w-[80px] rounded border border-gray-200 px-2 py-1"
                        value={row[field]}
                        onChange={(e) => updateRow(row.rowIndex, field, e.target.value)}
                        disabled={!canWrite}
                      />
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Poznámky zadavatele</label>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={!canWrite}
        />
      </div>

      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Ukládám…" : orderId ? "Uložit změny" : "Vytvořit zakázku"}
          </button>
          {orderId && canSubmitToProduction && (
            <>
              <button
                type="button"
                onClick={() => runAction("/submit", "Zadání pro mailing")}
                disabled={saving || !templateReady}
                title={!templateReady ? "Šablona není připravena k tisku" : undefined}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Zadat pro mailing
              </button>
              <button
                type="button"
                onClick={() => runAction("/submit-mistri", "Zadání pro mistry")}
                disabled={saving || !templateReady}
                title={!templateReady ? "Šablona není připravena k tisku" : undefined}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Zadat pro mistry
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import DatePickerField from "./DatePickerField";

// ─── Typy ─────────────────────────────────────────────────────────────────────
type CodebookOption = {
  id: number;
  category: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  shortCode: string | null;
  isWarning: boolean;
};

export type QueueItemPayload = {
  orderNumber: string;
  type: string;
  durationHours: number;
  description: string;
  dataStatusId: number | null;
  dataStatusLabel: string | null;
  dataRequiredDate: string | null;
  materialStatusId: number | null;
  materialStatusLabel: string | null;
  materialRequiredDate: string | null;
  barvyStatusId: number | null;
  barvyStatusLabel: string | null;
  lakStatusId: number | null;
  lakStatusLabel: string | null;
  specifikace: string;
  deadlineExpedice: string;
  recurrenceType: string;
  recurrenceCount: number;
};

const TYPE_BUILDER_CONFIG = {
  ZAKAZKA:   { emoji: "📋", label: "Zakázka",        color: "#1a6bcc" },
  REZERVACE: { emoji: "📌", label: "Rezervace",       color: "#7c3aed" },
  UDRZBA:    { emoji: "🔧", label: "Údržba / Oprava", color: "#c0392b" },
} as const;

const DURATION_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const totalMinutes = (i + 1) * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return { label: `${h}:${m.toString().padStart(2, "0")}`, hours: totalMinutes / 60 };
});

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h} hod`;
  return `${h}:${m.toString().padStart(2, "0")} hod`;
}

// ─── JobBuilderForm ───────────────────────────────────────────────────────────
export default function JobBuilderForm({
  onAddToQueue,
  showHeader = true,
}: {
  onAddToQueue: (item: QueueItemPayload) => void;
  showHeader?: boolean;
}) {
  const [orderNumber, setOrderNumber] = useState("");
  const [type, setType] = useState("ZAKAZKA");
  const [durationHours, setDurationHours] = useState(1);
  const [description, setDescription] = useState("");
  const [bDeadlineExpedice, setBDeadlineExpedice] = useState("");
  const [bDataStatusId, setBDataStatusId] = useState<string>("");
  const [bDataRequiredDate, setBDataRequiredDate] = useState<string>("");
  const [bMaterialStatusId, setBMaterialStatusId] = useState<string>("");
  const [bMaterialRequiredDate, setBMaterialRequiredDate] = useState<string>("");
  const [bBarvyStatusId, setBBarvyStatusId] = useState<string>("");
  const [bLakStatusId, setBLakStatusId] = useState<string>("");
  const [bSpecifikace, setBSpecifikace] = useState("");
  const [bRecurrenceType, setBRecurrenceType] = useState("NONE");
  const [bRecurrenceCount, setBRecurrenceCount] = useState(2);

  const [bDataOpts, setBDataOpts] = useState<CodebookOption[]>([]);
  const [bMaterialOpts, setBMaterialOpts] = useState<CodebookOption[]>([]);
  const [bBarvyOpts, setBBarvyOpts] = useState<CodebookOption[]>([]);
  const [bLakOpts, setBLakOpts] = useState<CodebookOption[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/planovani/codebook?category=DATA").then((r) => r.json()),
      fetch("/api/planovani/codebook?category=MATERIAL").then((r) => r.json()),
      fetch("/api/planovani/codebook?category=BARVY").then((r) => r.json()),
      fetch("/api/planovani/codebook?category=LAK").then((r) => r.json()),
    ]).then(([d, m, b, l]) => {
      setBDataOpts(d);
      setBMaterialOpts(m);
      setBBarvyOpts(b);
      setBLakOpts(l);
    }).catch(console.error);
  }, []);

  const typeConfig = TYPE_BUILDER_CONFIG[type as keyof typeof TYPE_BUILDER_CONFIG];
  const findLabel = (opts: CodebookOption[], id: string) =>
    opts.find((o) => String(o.id) === id)?.label ?? null;

  function handleAddToQueue() {
    if (!orderNumber.trim()) return;
    onAddToQueue({
      orderNumber: orderNumber.trim(),
      type,
      durationHours,
      description: description.trim(),
      dataStatusId: bDataStatusId ? Number(bDataStatusId) : null,
      dataStatusLabel: findLabel(bDataOpts, bDataStatusId),
      dataRequiredDate: bDataRequiredDate || null,
      materialStatusId: bMaterialStatusId ? Number(bMaterialStatusId) : null,
      materialStatusLabel: findLabel(bMaterialOpts, bMaterialStatusId),
      materialRequiredDate: bMaterialRequiredDate || null,
      barvyStatusId: bBarvyStatusId ? Number(bBarvyStatusId) : null,
      barvyStatusLabel: findLabel(bBarvyOpts, bBarvyStatusId),
      lakStatusId: bLakStatusId ? Number(bLakStatusId) : null,
      lakStatusLabel: findLabel(bLakOpts, bLakStatusId),
      specifikace: bSpecifikace,
      deadlineExpedice: bDeadlineExpedice,
      recurrenceType: bRecurrenceType,
      recurrenceCount: bRecurrenceType !== "NONE" ? bRecurrenceCount : 1,
    });
    setOrderNumber("");
    setDescription("");
    setBDataStatusId("");
    setBDataRequiredDate("");
    setBMaterialStatusId("");
    setBMaterialRequiredDate("");
    setBBarvyStatusId("");
    setBLakStatusId("");
    setBSpecifikace("");
    setBDeadlineExpedice("");
    setBRecurrenceType("NONE");
    setBRecurrenceCount(2);
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "var(--surface)", borderLeft: "1px solid var(--border)" }}>
      {showHeader && (
        <div style={{ padding: "12px 16px", background: "linear-gradient(135deg, color-mix(in oklab, var(--surface-2) 95%, transparent) 0%, var(--surface) 100%)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #e53e3e 0%, #dd6b20 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#fff", fontSize: 15, flexShrink: 0 }}>
              J
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>Job Builder</div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 2 }}>Integraf</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 16px", flex: 1 }}>
          {/* Typ záznamu */}
          <div style={{ paddingTop: 16, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>Typ záznamu</div>
            <div style={{ display: "flex", gap: 6 }}>
              {(Object.entries(TYPE_BUILDER_CONFIG) as [string, typeof TYPE_BUILDER_CONFIG[keyof typeof TYPE_BUILDER_CONFIG]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  style={{
                    flex: 1, padding: "8px 4px", borderRadius: 7,
                    border: type === key ? `1px solid ${cfg.color}` : "1px solid var(--border)",
                    background: type === key ? `${cfg.color}22` : "var(--surface-2)",
                    cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{cfg.emoji}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: type === key ? cfg.color : "var(--text-muted)", letterSpacing: "0.04em", lineHeight: 1.3, textAlign: "center" }}>
                    {cfg.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Zakázka */}
          <div style={{ paddingTop: 14, paddingBottom: 14, borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              {type === "UDRZBA" ? "Popis" : "Zakázka"}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: "0 0 130px" }}>
                <Label style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>
                  {type === "UDRZBA" ? "Název / označení" : "Číslo zakázky"} *
                </Label>
                <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder={type === "UDRZBA" ? "Čištění hlavy…" : "17001"} className="h-8 text-xs" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5, display: "block", fontWeight: 500 }}>Délka tisku</label>
                <div style={{ position: "relative" }}>
                  <select
                    value={String(durationHours)}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    style={{
                      appearance: "none", width: "100%", height: 32,
                      background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10,
                      color: "var(--text)", fontSize: 13, fontWeight: 600,
                      padding: "0 36px 0 14px", cursor: "pointer", outline: "none",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ring)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.hours} value={String(opt.hours)}>{opt.label}</option>
                    ))}
                  </select>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" color="var(--text-muted)"
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, pointerEvents: "none" }}>
                    <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                <Label style={{ fontSize: 10, color: "var(--text-muted)" }}>Popis</Label>
                <button type="button" onClick={() => navigator.clipboard.writeText(description)} title="Kopírovat popis"
                  style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1, transition: "color 120ms ease-out" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Kopírovat
                </button>
              </div>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Firma – produkt – počet tisků…" className="text-xs resize-none" />
            </div>
          </div>

          {/* Výrobní sloupečky */}
          {type !== "UDRZBA" && (
            <div style={{ paddingTop: 14, paddingBottom: 14, borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)" }}>Výrobní sloupečky</div>
              <div>
                <label style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5, display: "block", fontWeight: 500 }}>Data</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ flex: "0 0 130px" }}><DatePickerField value={bDataRequiredDate} onChange={setBDataRequiredDate} placeholder="Datum dodání…" /></div>
                  <div style={{ position: "relative", flex: 1 }}>
                    <select value={bDataStatusId} onChange={(e) => setBDataStatusId(e.target.value)}
                      style={{ appearance: "none", width: "100%", height: 32, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, color: bDataStatusId ? "var(--text)" : "var(--text-muted)", fontSize: 12, fontWeight: 600, padding: "0 32px 0 12px", cursor: "pointer", outline: "none" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ring)")} onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}>
                      <option value="">— info —</option>
                      {bDataOpts.map((o) => (<option key={o.id} value={String(o.id)}>{o.isWarning ? "⚠ " : ""}{o.label}</option>))}
                    </select>
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" color="var(--text-muted)" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, pointerEvents: "none" }}><path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5, display: "block", fontWeight: 500 }}>Materiál</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ flex: "0 0 130px" }}><DatePickerField value={bMaterialRequiredDate} onChange={setBMaterialRequiredDate} placeholder="Datum dodání…" /></div>
                  <div style={{ position: "relative", flex: 1 }}>
                    <select value={bMaterialStatusId} onChange={(e) => setBMaterialStatusId(e.target.value)}
                      style={{ appearance: "none", width: "100%", height: 32, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, color: bMaterialStatusId ? "var(--text)" : "var(--text-muted)", fontSize: 12, fontWeight: 600, padding: "0 32px 0 12px", cursor: "pointer", outline: "none" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ring)")} onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}>
                      <option value="">— info —</option>
                      {bMaterialOpts.map((o) => (<option key={o.id} value={String(o.id)}>{o.isWarning ? "⚠ " : ""}{o.label}</option>))}
                    </select>
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" color="var(--text-muted)" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, pointerEvents: "none" }}><path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {([
                  { label: "Barvy", value: bBarvyStatusId, setter: setBBarvyStatusId, opts: bBarvyOpts },
                  { label: "Lak", value: bLakStatusId, setter: setBLakStatusId, opts: bLakOpts },
                ] as { label: string; value: string; setter: (v: string) => void; opts: CodebookOption[] }[]).map(({ label, value, setter, opts }) => (
                  <div key={label}>
                    <label style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5, display: "block", fontWeight: 500 }}>{label}</label>
                    <div style={{ position: "relative" }}>
                      <select value={value} onChange={(e) => setter(e.target.value)}
                        style={{ appearance: "none", width: "100%", height: 32, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, color: value ? "var(--text)" : "var(--text-muted)", fontSize: 12, fontWeight: 600, padding: "0 32px 0 12px", cursor: "pointer", outline: "none" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ring)")} onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}>
                        <option value="">— nezadáno —</option>
                        {opts.map((o) => (<option key={o.id} value={String(o.id)}>{o.isWarning ? "⚠ " : ""}{o.label}</option>))}
                      </select>
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" color="var(--text-muted)" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, pointerEvents: "none" }}><path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <Label style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>Specifikace</Label>
                <Input value={bSpecifikace} onChange={(e) => setBSpecifikace(e.target.value)} placeholder="Volný text…" className="h-8 text-xs" />
              </div>
              <div>
                <Label style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>Termín expedice</Label>
                <DatePickerField value={bDeadlineExpedice} onChange={setBDeadlineExpedice} placeholder="Datum expedice…" />
              </div>
            </div>
          )}

          {/* Opakování */}
          <div style={{ paddingTop: 14, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>Opakování</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5, display: "block", fontWeight: 500 }}>Interval</label>
                <div style={{ position: "relative" }}>
                  <select value={bRecurrenceType} onChange={(e) => setBRecurrenceType(e.target.value)}
                    style={{ appearance: "none", width: "100%", height: 32, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, color: bRecurrenceType !== "NONE" ? "var(--accent)" : "var(--text)", fontSize: 12, fontWeight: 600, padding: "0 32px 0 12px", cursor: "pointer", outline: "none" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ring)")} onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
                    <option value="NONE">— bez opakování —</option>
                    <option value="DAILY">↻ Každý den</option>
                    <option value="WEEKLY">↻ Každý týden</option>
                    <option value="MONTHLY">↻ Každý měsíc</option>
                  </select>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" color="var(--text-muted)" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, pointerEvents: "none" }}><path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
              {bRecurrenceType !== "NONE" && (
                <div style={{ flex: "0 0 90px" }}>
                  <label style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5, display: "block", fontWeight: 500 }}>Počet bloků</label>
                  <input type="number" min={2} max={52} value={bRecurrenceCount}
                    onChange={(e) => setBRecurrenceCount(Math.max(2, Math.min(52, parseInt(e.target.value) || 2)))}
                    style={{ width: "100%", height: 32, background: "var(--surface-2)", border: "1px solid var(--accent)", borderRadius: 10, color: "var(--accent)", fontSize: 13, fontWeight: 700, padding: "0 10px", outline: "none", textAlign: "center" }}
                  />
                </div>
              )}
            </div>
            {bRecurrenceType !== "NONE" && (
              <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 6, opacity: 0.8 }}>
                Vytvoří se {bRecurrenceCount} bloků · interval: {bRecurrenceType === "DAILY" ? "1 den" : bRecurrenceType === "WEEKLY" ? "7 dní" : "1 měsíc"}
              </div>
            )}
          </div>

          {/* Náhled */}
          <div style={{ paddingTop: 14, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Náhled bloku</div>
            <div style={{ borderRadius: 6, padding: "9px 11px", background: `${typeConfig?.color ?? "#334155"}18`, borderLeft: `3px solid ${typeConfig?.color ?? "var(--text-muted)"}`, border: `1px solid ${typeConfig?.color ?? "var(--text-muted)"}33` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>{orderNumber || <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>—</span>}</div>
              {description && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.4 }}>{description}</div>}
              <div style={{ fontSize: 10, color: typeConfig?.color ?? "var(--text-muted)", marginTop: 5 }}>{typeConfig?.emoji} {typeConfig?.label} · {formatDuration(durationHours)}</div>
            </div>
          </div>

          {/* Přidat do fronty */}
          <div style={{ paddingTop: 14, paddingBottom: 16 }}>
            <Button type="button" variant="ghost" onClick={handleAddToQueue} disabled={!orderNumber.trim()}
              className="w-full text-xs font-semibold border border-yellow-400/35 bg-yellow-400/[0.06] text-yellow-400 hover:bg-yellow-400/[0.12] hover:text-yellow-400 disabled:text-slate-600 disabled:border-slate-700 disabled:bg-transparent">
              ＋ Přidat do fronty
            </Button>
            <div style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center", marginTop: 6 }}>
              Přetáhni kartu z fronty na timeline → stroj a čas
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

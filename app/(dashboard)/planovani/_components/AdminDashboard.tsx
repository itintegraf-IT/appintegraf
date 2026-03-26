"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanovaniSession } from "@/lib/planovani-auth";

// ─── Typy ────────────────────────────────────────────────────────────────────

interface CodebookItem {
  id: number;
  category: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  isWarning: boolean;
  shortCode: string | null;
  badgeColor?: string | null;
}

// ─── Konstanty ───────────────────────────────────────────────────────────────

const CATEGORIES = ["DATA", "MATERIAL", "BARVY", "LAK"] as const;
type Category = typeof CATEGORIES[number];
const CATEGORY_LABELS: Record<Category, string> = {
  DATA: "DATA",
  MATERIAL: "MATERIÁL",
  BARVY: "BARVY",
  LAK: "LAK",
};

// ─── Styly ───────────────────────────────────────────────────────────────────

const PAGE_BG = "var(--bg)";
const SECTION_BG = "var(--surface)";
const SEPARATOR = "color-mix(in oklab, var(--border) 70%, transparent)";
const TEXT_PRIMARY = "var(--text)";
const TEXT_SECONDARY = "var(--text-muted)";
const BORDER_SUBTLE = "var(--border)";

const inputStyle: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "7px 11px",
  color: TEXT_PRIMARY,
  fontSize: 13,
  fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  background: "var(--brand)",
  color: "var(--brand-contrast)",
  border: "none",
  borderRadius: 8,
  padding: "7px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  whiteSpace: "nowrap",
};

const btnSecondary: React.CSSProperties = {
  background: "var(--surface-2)",
  color: TEXT_SECONDARY,
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "7px 16px",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  whiteSpace: "nowrap",
};

const btnDanger: React.CSSProperties = {
  background: "color-mix(in oklab, var(--danger) 15%, transparent)",
  color: "var(--danger)",
  border: "1px solid color-mix(in oklab, var(--danger) 25%, transparent)",
  borderRadius: 8,
  padding: "5px 12px",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  whiteSpace: "nowrap",
};

// ─── Komponenta ──────────────────────────────────────────────────────────────

export default function AdminDashboard({ currentUser }: { currentUser: PlanovaniSession }) {
  const [activeTab, setActiveTab] = useState<"codebook" | "company-days" | "audit">("codebook");

  return (
    <div style={{
      minHeight: "100vh",
      background: PAGE_BG,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      color: TEXT_PRIMARY,
    }}>
      {/* Top bar */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "color-mix(in oklab, var(--surface) 88%, transparent)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${SEPARATOR}`,
        padding: "0 20px",
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <a href="/planovani" style={{
          display: "flex", alignItems: "center", gap: 6,
          color: "var(--accent)", fontSize: 14, textDecoration: "none",
          fontWeight: 500,
        }}>
          <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
            <path d="M7 1L1 6.5L7 12" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Plánování
        </a>
        <span style={{ fontSize: 16, fontWeight: 600, position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
          Správa systému
        </span>
        <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>{currentUser.username}</span>
      </div>

      {/* Tab switcher */}
      <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "center" }}>
        <div style={{
          display: "flex",
          background: "var(--surface-2)",
          borderRadius: 10,
          padding: 3,
          gap: 3,
        }}>
          {(currentUser.role === "ADMIN" ? (["codebook", "company-days", "audit"] as const) : (["codebook", "company-days"] as const)).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "7px 20px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                transition: "all 0.15s ease-out",
                background: activeTab === tab ? "var(--surface-3)" : "transparent",
                color: activeTab === tab ? TEXT_PRIMARY : TEXT_SECONDARY,
              }}
            >
              {tab === "codebook" ? "Číselníky" : tab === "company-days" ? "Firemní dny" : "Audit log"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px" }}>
        {activeTab === "codebook" ? (
          <CodebookSection />
        ) : activeTab === "company-days" ? (
          <CompanyDaysSection />
        ) : (
          <AuditLogSection />
        )}
      </div>
    </div>
  );
}

// ─── Tab: Audit log ───────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: number;
  blockId: number;
  userId: number;
  username: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

const AUDIT_FIELD_LABELS: Record<string, string> = {
  dataStatusLabel: "DATA stav",
  dataRequiredDate: "DATA datum",
  dataOk: "DATA OK",
  materialStatusLabel: "Materiál stav",
  materialRequiredDate: "Materiál datum",
  materialOk: "Materiál OK",
  materialNote: "Materiál poznámka",
  deadlineExpedice: "Expedice termín",
  blockVariant: "Varianta zakázky",
};

function AuditLogSection() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/planovani/audit?limit=50")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setLogs(data);
        setLoading(false);
      })
      .catch(() => {
        setLogs([]);
        setLoading(false);
      });
  }, []);

  function fmtDatetime(iso: string) {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit" }) +
      " " +
      d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })
    );
  }

  function fmtVal(val: string | null, field: string | null) {
    if (!val || val === "null") return "—";
    if (field === "dataOk" || field === "materialOk") return val === "true" ? "✓ OK" : "✗ Ne";
    if (val.match(/^\d{4}-\d{2}-\d{2}T/)) {
      try {
        return new Date(val).toLocaleDateString("cs-CZ");
      } catch {
        return val;
      }
    }
    return val;
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", color: TEXT_SECONDARY, padding: 40, fontSize: 13 }}>
        Načítám…
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 12 }}>
        Posledních 50 záznamů
      </div>
      {logs.length === 0 ? (
        <div style={{ textAlign: "center", color: TEXT_SECONDARY, padding: 40, fontSize: 13 }}>
          Žádné záznamy.
        </div>
      ) : (
        <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${SEPARATOR}` }}>
          {logs.map((log, i) => (
            <div
              key={log.id}
              style={{
                display: "grid",
                gridTemplateColumns: "100px 80px 70px 1fr",
                gap: 8,
                padding: "10px 14px",
                borderTop: i > 0 ? `1px solid ${SEPARATOR}` : undefined,
                background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                alignItems: "center",
                fontSize: 12,
              }}
            >
              <span style={{ color: TEXT_SECONDARY }}>{fmtDatetime(log.createdAt)}</span>
              <span style={{ fontWeight: 600, color: TEXT_PRIMARY }}>{log.username}</span>
              <span style={{ color: TEXT_SECONDARY }}>#{log.blockId}</span>
              <span style={{ color: TEXT_PRIMARY }}>
                {log.action === "UPDATE" && log.field ? (
                  <>
                    {AUDIT_FIELD_LABELS[log.field] ?? log.field}:{" "}
                    <span style={{ color: TEXT_SECONDARY }}>{fmtVal(log.oldValue, log.field)}</span>
                    {" → "}
                    <span style={{ color: TEXT_PRIMARY }}>{fmtVal(log.newValue, log.field)}</span>
                  </>
                ) : log.action === "CREATE" ? (
                  <span style={{ color: "#30d158" }}>Přidána</span>
                ) : log.action === "DELETE" ? (
                  <span style={{ color: "#ff453a" }}>Smazána</span>
                ) : (
                  log.action
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Firemní dny ────────────────────────────────────────────────────────

interface CompanyDayItem {
  id: number;
  startDate: string;
  endDate: string;
  label: string;
  createdAt: string;
}

function CompanyDaysSection() {
  const [days, setDays] = useState<CompanyDayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addStartDate, setAddStartDate] = useState("");
  const [addEndDate, setAddEndDate] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  async function loadDays() {
    setLoading(true);
    const res = await fetch("/api/planovani/company-days");
    if (res.ok) setDays(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadDays(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addStartDate || !addEndDate || !addLabel.trim()) return;
    setAddLoading(true);
    const res = await fetch("/api/planovani/company-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: addStartDate, endDate: addEndDate, label: addLabel.trim() }),
    });
    if (res.ok) {
      setAddStartDate(""); setAddEndDate(""); setAddLabel("");
      setShowAddForm(false);
      await loadDays();
    }
    setAddLoading(false);
  }

  async function handleDelete(id: number) {
    await fetch(`/api/planovani/company-days/${id}`, { method: "DELETE" });
    await loadDays();
  }

  function fmtDate(s: string): string {
    return new Date(s).toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Firemní dny (svátky, odstávky)
        </span>
        <button
          onClick={() => { setShowAddForm(!showAddForm); }}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "transparent", border: "none",
            color: "var(--accent)", fontSize: 13, fontWeight: 500,
            cursor: "pointer", padding: "4px 8px",
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6.25" stroke="var(--accent)" strokeWidth="1.5"/>
            <line x1="7" y1="4" x2="7" y2="10" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="4" y1="7" x2="10" y2="7" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Přidat
        </button>
      </div>

      <div style={{ background: SECTION_BG, borderRadius: 12, overflow: "hidden", border: `1px solid ${BORDER_SUBTLE}` }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: TEXT_SECONDARY, fontSize: 13 }}>Načítám...</div>
        ) : days.length === 0 && !showAddForm ? (
          <div style={{ padding: 24, textAlign: "center", color: TEXT_SECONDARY, fontSize: 13 }}>Žádné firemní dny</div>
        ) : (
          days.map((d, i) => (
            <div
              key={d.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: i < days.length - 1 ? `1px solid ${SEPARATOR}` : "none",
              }}
            >
              <div>
                <span style={{ fontSize: 14, fontWeight: 500, color: TEXT_PRIMARY }}>{d.label}</span>
                <span style={{ fontSize: 12, color: TEXT_SECONDARY, marginLeft: 8 }}>
                  {fmtDate(d.startDate)} – {fmtDate(d.endDate)}
                </span>
              </div>
              <button
                onClick={() => handleDelete(d.id)}
                style={{ ...btnDanger, padding: "4px 10px" }}
              >
                Smazat
              </button>
            </div>
          ))
        )}
        {showAddForm && (
          <div style={{ borderTop: days.length > 0 ? `1px solid ${SEPARATOR}` : "none", padding: 16 }}>
            <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={inputStyle} type="date" value={addStartDate} onChange={(e) => setAddStartDate(e.target.value)} placeholder="Od" required />
              <input style={inputStyle} type="date" value={addEndDate} onChange={(e) => setAddEndDate(e.target.value)} placeholder="Do" required />
              <input style={inputStyle} value={addLabel} onChange={(e) => setAddLabel(e.target.value)} placeholder="Popis (např. Vánoční přestávka)" required />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" style={btnSecondary} onClick={() => setShowAddForm(false)}>Zrušit</button>
                <button type="submit" style={btnPrimary} disabled={addLoading || !addStartDate || !addEndDate || !addLabel.trim()}>
                  {addLoading ? "Přidávám..." : "Přidat"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      <p style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 12 }}>
        Správa uživatelů a jejich oprávnění k modulu plánování probíhá v{" "}
        <a href="/admin/users" style={{ color: "var(--accent)", textDecoration: "underline" }}>Administraci → Uživatelé</a>.
      </p>
    </div>
  );
}

// ─── Tab: Číselníky ──────────────────────────────────────────────────────────

function CodebookSection() {
  const [category, setCategory] = useState<Category>("DATA");
  const [items, setItems] = useState<CodebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLabel, setAddLabel] = useState("");
  const [addIsWarning, setAddIsWarning] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  async function loadItems(cat: Category) {
    setLoading(true);
    const res = await fetch(`/api/planovani/codebook?category=${cat}&includeInactive=true`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    setShowAddForm(false);
    setAddLabel("");
    loadItems(category);
  }, [category]);

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!addLabel.trim()) return;
    setAddLoading(true);
    const res = await fetch("/api/planovani/codebook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, label: addLabel.trim(), isWarning: addIsWarning }),
    });
    if (res.ok) {
      setAddLabel(""); setAddIsWarning(false); setShowAddForm(false);
      await loadItems(category);
    }
    setAddLoading(false);
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;
    const a = items[index - 1];
    const b = items[index];
    await Promise.all([
      fetch(`/api/planovani/codebook/${a.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: b.sortOrder }),
      }),
      fetch(`/api/planovani/codebook/${b.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: a.sortOrder }),
      }),
    ]);
    await loadItems(category);
  }

  async function handleMoveDown(index: number) {
    if (index === items.length - 1) return;
    const a = items[index];
    const b = items[index + 1];
    await Promise.all([
      fetch(`/api/planovani/codebook/${a.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: b.sortOrder }),
      }),
      fetch(`/api/planovani/codebook/${b.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: a.sortOrder }),
      }),
    ]);
    await loadItems(category);
  }

  return (
    <div>
      {/* Category tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              border: `1px solid ${category === cat ? "var(--accent)" : BORDER_SUBTLE}`,
              background: category === cat ? "color-mix(in oklab, var(--accent) 15%, transparent)" : "transparent",
              color: category === cat ? "var(--accent)" : TEXT_SECONDARY,
              fontSize: 13,
              fontWeight: category === cat ? 600 : 400,
              cursor: "pointer",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              transition: "all 0.1s ease-out",
            }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {CATEGORY_LABELS[category]}
        </span>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setAddLabel(""); setAddIsWarning(false); }}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "transparent", border: "none",
            color: "var(--accent)", fontSize: 13, fontWeight: 500,
            cursor: "pointer", padding: "4px 8px",
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6.25" stroke="var(--accent)" strokeWidth="1.5"/>
            <line x1="7" y1="4" x2="7" y2="10" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="4" y1="7" x2="10" y2="7" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Přidat
        </button>
      </div>

      <div style={{ background: SECTION_BG, borderRadius: 12, overflow: "hidden", border: `1px solid ${BORDER_SUBTLE}` }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: TEXT_SECONDARY, fontSize: 13 }}>Načítám...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: TEXT_SECONDARY, fontSize: 13 }}>Žádné položky</div>
        ) : (
          items.map((item, i) => (
            <CodebookRow
              key={item.id}
              item={item}
              isFirst={i === 0}
              isLast={i === items.length - 1 && !showAddForm}
              onMoveUp={() => handleMoveUp(i)}
              onMoveDown={() => handleMoveDown(i)}
              onUpdate={() => loadItems(category)}
            />
          ))
        )}

        {/* Přidat položku — inline form */}
        {showAddForm && (
          <div style={{
            borderTop: items.length > 0 ? `1px solid ${SEPARATOR}` : "none",
            padding: 16,
          }}>
            <form onSubmit={handleAddItem} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="Název položky"
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  autoFocus
                />
                <WarningToggle value={addIsWarning} onChange={setAddIsWarning} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" style={btnSecondary} onClick={() => { setShowAddForm(false); }}>Zrušit</button>
                <button type="submit" style={btnPrimary} disabled={addLoading || !addLabel.trim()}>
                  {addLoading ? "Přidávám..." : "Přidat"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function CodebookRow({ item, isFirst, isLast, onMoveUp, onMoveDown, onUpdate }: {
  item: CodebookItem;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(item.label);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  async function handleLabelSave() {
    if (!editLabel.trim() || editLabel.trim() === item.label) {
      setEditLabel(item.label);
      setEditing(false);
      return;
    }
    await fetch(`/api/planovani/codebook/${item.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editLabel.trim() }),
    });
    setEditing(false);
    onUpdate();
  }

  async function handleToggle(field: "isWarning" | "isActive") {
    await fetch(`/api/planovani/codebook/${item.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !item[field] }),
    });
    onUpdate();
  }

  async function handleDelete() {
    await fetch(`/api/planovani/codebook/${item.id}`, { method: "DELETE" });
    onUpdate();
  }

  const isInactive = !item.isActive;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: isLast ? "none" : `1px solid ${SEPARATOR}`,
        background: isInactive ? "color-mix(in oklab, var(--surface-2) 65%, transparent)" : "transparent",
        transition: "background 0.1s",
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 12px 0 8px",
        height: 52,
      }}>
        {/* Up/down buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            style={{
              background: "transparent", border: "none",
              color: isFirst ? "color-mix(in oklab, var(--text-muted) 35%, transparent)" : TEXT_SECONDARY,
              cursor: isFirst ? "default" : "pointer",
              padding: "1px 4px", lineHeight: 1, fontSize: 10,
              transition: "color 0.1s",
            }}
            title="Posunout nahoru"
          >▲</button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            style={{
              background: "transparent", border: "none",
              color: isLast ? "color-mix(in oklab, var(--text-muted) 35%, transparent)" : TEXT_SECONDARY,
              cursor: isLast ? "default" : "pointer",
              padding: "1px 4px", lineHeight: 1, fontSize: 10,
              transition: "color 0.1s",
            }}
            title="Posunout dolů"
          >▼</button>
        </div>

        {/* Label — kliknutí zahájí editaci */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              ref={inputRef}
              style={{ ...inputStyle, padding: "4px 8px", fontSize: 13 }}
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onBlur={handleLabelSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLabelSave();
                if (e.key === "Escape") { setEditLabel(item.label); setEditing(false); }
              }}
            />
          ) : (
            <span
              onClick={() => { setEditing(true); setEditLabel(item.label); }}
              style={{
                fontSize: 13,
                color: isInactive ? TEXT_SECONDARY : (item.isWarning ? "var(--warning)" : TEXT_PRIMARY),
                cursor: "text",
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textDecoration: isInactive ? "line-through" : "none",
                opacity: isInactive ? 0.6 : 1,
              }}
              title="Klikněte pro editaci"
            >
              {item.label}
            </span>
          )}
        </div>

        {/* isWarning toggle */}
        <WarningToggle value={item.isWarning} onChange={() => handleToggle("isWarning")} compact />

        {/* isActive toggle */}
        <button
          onClick={() => handleToggle("isActive")}
          title={item.isActive ? "Aktivní (klikněte pro deaktivaci)" : "Neaktivní (klikněte pro aktivaci)"}
          style={{
            width: 32, height: 18, borderRadius: 9,
            background: item.isActive ? "var(--success)" : "var(--surface-3)",
            border: "none", cursor: "pointer",
            position: "relative", flexShrink: 0,
            transition: "background 0.15s ease-out",
          }}
        >
          <span style={{
            position: "absolute",
            width: 14, height: 14,
            borderRadius: "50%",
            background: "var(--text)",
            top: 2,
            left: item.isActive ? 16 : 2,
            transition: "left 0.15s ease-out",
          }} />
        </button>

        {/* Delete — hover reveal */}
        <button
          onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
          style={{
            background: "transparent", border: "none",
            padding: "4px", cursor: "pointer",
            opacity: hovered ? 1 : 0,
            transition: "opacity 0.15s ease-out",
            color: "var(--danger)",
            display: "flex", alignItems: "center",
          }}
          title="Smazat položku"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M4 3.5l.5 7.5h5L10 3.5" stroke="var(--danger)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Confirm smazání */}
      {showDeleteConfirm && (
        <div style={{ padding: "0 16px 12px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: TEXT_SECONDARY, flex: 1 }}>
            Smazat <strong style={{ color: TEXT_PRIMARY }}>{item.label}</strong>?
            {" "}<span style={{ fontSize: 11 }}>(existující zakázky zachovají svůj stav)</span>
          </span>
          <button style={btnSecondary} onClick={() => setShowDeleteConfirm(false)}>Zrušit</button>
          <button style={btnDanger} onClick={handleDelete}>Smazat</button>
        </div>
      )}
    </div>
  );
}

// ─── Warning toggle ───────────────────────────────────────────────────────────

function WarningToggle({ value, onChange, compact }: {
  value: boolean;
  onChange: (v: boolean) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      title={value ? "Upozornění zapnuto" : "Upozornění vypnuto"}
      style={{
        display: "flex", alignItems: "center", gap: compact ? 0 : 5,
        background: value ? "color-mix(in oklab, var(--warning) 15%, transparent)" : "var(--surface-2)",
        border: `1px solid ${value ? "color-mix(in oklab, var(--warning) 40%, transparent)" : BORDER_SUBTLE}`,
        borderRadius: 6,
        padding: compact ? "4px 6px" : "5px 10px",
        color: value ? "var(--warning)" : TEXT_SECONDARY,
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        transition: "all 0.15s ease-out",
        flexShrink: 0,
      }}
    >
      ⚠{!compact && <span style={{ fontSize: 11 }}>{value ? "Warn" : "off"}</span>}
    </button>
  );
}

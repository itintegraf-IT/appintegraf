"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  INTERNAL_SECTIONS,
  VENDOR_SECTIONS,
  emptyContact,
  emptyDevice,
  emptyFw,
  type FormState,
  type Lookups,
} from "./types";

type Props = {
  form: FormState;
  setForm: (updater: (prev: FormState) => FormState) => void;
  lookups: Lookups;
  mode: "vendor" | "internal";
  readOnly?: boolean;
  section: number;
  onSectionChange: (n: number) => void;
  onSave?: () => void;
  saving?: boolean;
  /** Pro načtení volných IP z registru (interní režim). */
  requestId?: number;
};

type VlanOption = { id: number; vlan_number: number; name: string; active: boolean };
type RegistryIp = { ip_address: string; status: string };

function Field({
  label,
  children,
  className = "",
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
      {hint ? <span className="mt-0.5 block text-xs text-gray-500">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-100";

const itInputCls =
  "w-full rounded-md border border-slate-400 px-3 py-2 text-sm shadow-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-gray-100";

/** IP ze zadaných rozsahů u zařízení (stejná /24, max 64 adres na rozsah). */
function suggestedIpsFromDevices(
  devices: { assigned_ip_from?: string | null; assigned_ip_to?: string | null }[]
): string[] {
  const out = new Set<string>();
  for (const d of devices) {
    const from = (d.assigned_ip_from ?? "").trim();
    const to = (d.assigned_ip_to ?? "").trim();
    if (from && !to) {
      out.add(from);
      continue;
    }
    if (!from && to) {
      out.add(to);
      continue;
    }
    if (!from || !to) continue;

    const mFrom = from.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    const mTo = to.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (!mFrom || !mTo) {
      out.add(from);
      if (to !== from) out.add(to);
      continue;
    }
    if (mFrom[1] !== mTo[1] || mFrom[2] !== mTo[2] || mFrom[3] !== mTo[3]) {
      out.add(from);
      out.add(to);
      continue;
    }
    const a = Number(mFrom[4]);
    const b = Number(mTo[4]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) {
      out.add(from);
      out.add(to);
      continue;
    }
    const end = Math.min(b, a + 63);
    const base = `${mFrom[1]}.${mFrom[2]}.${mFrom[3]}.`;
    for (let i = a; i <= end; i++) out.add(`${base}${i}`);
  }
  return [...out].sort((x, y) => {
    const ax = x.split(".").map(Number);
    const ay = y.split(".").map(Number);
    for (let i = 0; i < 4; i++) {
      const d = (ax[i] ?? 0) - (ay[i] ?? 0);
      if (d) return d;
    }
    return 0;
  });
}

function VendorReadonly({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      {title ? <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">{title}</div> : null}
      {children}
    </div>
  );
}

export function ItVendorForm({
  form,
  setForm,
  lookups,
  mode,
  readOnly,
  section,
  onSectionChange,
  onSave,
  saving,
  requestId,
}: Props) {
  const disabled = Boolean(readOnly);
  const sections = mode === "internal" ? INTERNAL_SECTIONS : VENDOR_SECTIONS;
  const maxSection = sections.length - 1;

  const [vlans, setVlans] = useState<VlanOption[]>([]);
  const [registryIps, setRegistryIps] = useState<RegistryIp[]>([]);

  useEffect(() => {
    if (mode !== "internal") return;
    void fetch("/api/it-network/vlans")
      .then((r) => r.json())
      .then((d) => setVlans(d.items ?? []))
      .catch(() => setVlans([]));
  }, [mode]);

  useEffect(() => {
    if (mode !== "internal" || !requestId) return;
    const params = new URLSearchParams({
      available_for: String(requestId),
    });
    if (form.assigned_vlan_id) params.set("vlan_id", String(form.assigned_vlan_id));
    void fetch(`/api/it-network/ips?${params}`)
      .then((r) => r.json())
      .then((d) =>
        setRegistryIps(
          (d.items ?? []).map((i: { ip_address: string; status: string }) => ({
            ip_address: i.ip_address,
            status: i.status,
          }))
        )
      )
      .catch(() => setRegistryIps([]));
  }, [mode, requestId, form.assigned_vlan_id, section]);

  const registryIpList = useMemo(
    () => registryIps.map((r) => r.ip_address),
    [registryIps]
  );

  /** Rozsahy: volné (+ vlastní) z registru; fallback na expand z from/to. */
  const rangeChoices = registryIpList.length
    ? registryIpList
    : suggestedIpsFromDevices(form.devices);

  const rangeFromDevices = suggestedIpsFromDevices(form.devices);
  const firewallIpChoices =
    rangeFromDevices.length > 0
      ? rangeFromDevices.filter((ip) => !registryIpList.length || registryIpList.includes(ip))
      : registryIpList;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      {mode === "vendor" && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Vyplňuje <strong>externí dodavatel</strong>. IP adresy a číslo VLAN přidělí IT —
          uveďte jen počty a požadavky.
        </p>
      )}
      {mode === "internal" && section < 4 && (
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          Sekce 1–4: údaje dodavatele. Sekce 5: přidělení sítě IT.
        </p>
      )}

      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-2">
        {sections.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSectionChange(i)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              section === i
                ? i === 4
                  ? "bg-slate-700 text-white"
                  : "bg-red-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {mode === "internal" && (
            <>
              <Field label="Datum požadavku">
                <input
                  type="date"
                  className={inputCls}
                  disabled={disabled}
                  value={form.request_date ?? ""}
                  onChange={(e) => set("request_date", e.target.value || null)}
                />
              </Field>
              <Field label="Požadovaný termín realizace">
                <input
                  type="date"
                  className={inputCls}
                  disabled={disabled}
                  value={form.due_date ?? ""}
                  onChange={(e) => set("due_date", e.target.value || null)}
                />
              </Field>
            </>
          )}
          {mode === "vendor" && (
            <Field label="Požadovaný termín realizace" className="sm:col-span-2">
              <input
                type="date"
                className={inputCls}
                disabled={disabled}
                value={form.due_date ?? ""}
                onChange={(e) => set("due_date", e.target.value || null)}
              />
            </Field>
          )}
          <Field label="Projekt / Technologie" className="sm:col-span-2">
            <input
              className={inputCls}
              disabled={disabled}
              value={form.project_name ?? ""}
              onChange={(e) => set("project_name", e.target.value || null)}
            />
          </Field>
          <Field label="Dodavatel (název firmy)" className="sm:col-span-2">
            <input
              className={inputCls}
              disabled={disabled}
              value={form.vendor_company ?? ""}
              onChange={(e) => set("vendor_company", e.target.value || null)}
            />
          </Field>

          <div className="sm:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Kontaktní osoby</h3>
              {!disabled && (
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, contacts: [...p.contacts, emptyContact()] }))
                  }
                  className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
                >
                  + Přidat kontakt
                </button>
              )}
            </div>
            {form.contacts.map((row, idx) => (
              <div
                key={idx}
                className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Kontakt {idx + 1}</span>
                  {!disabled && form.contacts.length > 1 && (
                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          contacts: p.contacts.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      Odebrat
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Role">
                    <select
                      className={inputCls}
                      disabled={disabled}
                      value={row.role ?? ""}
                      onChange={(e) =>
                        setForm((p) => {
                          const contacts = [...p.contacts];
                          contacts[idx] = { ...row, role: e.target.value || null };
                          return { ...p, contacts };
                        })
                      }
                    >
                      <option value="">—</option>
                      {(lookups.contact_roles ?? []).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Jméno">
                    <input
                      className={inputCls}
                      disabled={disabled}
                      value={row.name ?? ""}
                      onChange={(e) =>
                        setForm((p) => {
                          const contacts = [...p.contacts];
                          contacts[idx] = { ...row, name: e.target.value || null };
                          return { ...p, contacts };
                        })
                      }
                    />
                  </Field>
                  <Field label="Telefon">
                    <input
                      className={inputCls}
                      disabled={disabled}
                      value={row.phone ?? ""}
                      onChange={(e) =>
                        setForm((p) => {
                          const contacts = [...p.contacts];
                          contacts[idx] = { ...row, phone: e.target.value || null };
                          return { ...p, contacts };
                        })
                      }
                    />
                  </Field>
                  <Field label="E-mail">
                    <input
                      type="email"
                      className={inputCls}
                      disabled={disabled}
                      value={row.email ?? ""}
                      onChange={(e) =>
                        setForm((p) => {
                          const contacts = [...p.contacts];
                          contacts[idx] = { ...row, email: e.target.value || null };
                          return { ...p, contacts };
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>

          <Field label="Výrobce a typ zařízení" className="sm:col-span-2">
            <input
              className={inputCls}
              disabled={disabled}
              value={form.device_vendor_type ?? ""}
              onChange={(e) => set("device_vendor_type", e.target.value || null)}
            />
          </Field>
          <Field label="Místo instalace" className="sm:col-span-2">
            <input
              className={inputCls}
              disabled={disabled}
              value={form.install_location ?? ""}
              onChange={(e) => set("install_location", e.target.value || null)}
              placeholder="Budova / hala / místnost"
            />
          </Field>
          <Field label="Účel řešení" className="sm:col-span-2">
            <textarea
              className={inputCls}
              rows={2}
              disabled={disabled}
              value={form.purpose ?? ""}
              onChange={(e) => set("purpose", e.target.value || null)}
            />
          </Field>
          <Field label="Popis technologie" className="sm:col-span-2">
            <textarea
              className={inputCls}
              rows={3}
              disabled={disabled}
              value={form.tech_description ?? ""}
              onChange={(e) => set("tech_description", e.target.value || null)}
            />
          </Field>
          <Field label="Požadované služby" className="sm:col-span-2">
            <textarea
              className={inputCls}
              rows={2}
              disabled={disabled}
              value={form.requested_services ?? ""}
              onChange={(e) => set("requested_services", e.target.value || null)}
            />
          </Field>
          <Field label="Poznámky" className="sm:col-span-2">
            <textarea
              className={inputCls}
              rows={2}
              disabled={disabled}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value || null)}
            />
          </Field>
        </div>
      )}

      {section === 1 && (
        <TableSection
          title="Zařízení a požadavek na IP"
          hint="Uveďte zařízení a kolik IP adres potřebujete. Konkrétní adresy přidělí IT."
          disabled={disabled}
          onAdd={() => setForm((p) => ({ ...p, devices: [...p.devices, emptyDevice()] }))}
        >
          {form.devices.map((row, idx) => (
            <div key={idx} className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Zařízení {idx + 1}</span>
                {!disabled && form.devices.length > 1 && (
                  <button
                    type="button"
                    className="text-red-600"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        devices: p.devices.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    Odebrat
                  </button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Zařízení / skupina">
                  <input
                    className={inputCls}
                    disabled={disabled}
                    value={row.device_group ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const devices = [...p.devices];
                        devices[idx] = { ...row, device_group: e.target.value || null };
                        return { ...p, devices };
                      })
                    }
                  />
                </Field>
                <Field label="Typ rozhraní">
                  <select
                    className={inputCls}
                    disabled={disabled}
                    value={row.interface_type ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const devices = [...p.devices];
                        devices[idx] = { ...row, interface_type: e.target.value || null };
                        return { ...p, devices };
                      })
                    }
                  >
                    <option value="">—</option>
                    {lookups.interface_types.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Rychlost (Mb/s)">
                  <input
                    type="number"
                    className={inputCls}
                    disabled={disabled}
                    value={row.speed_mbps ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const devices = [...p.devices];
                        devices[idx] = {
                          ...row,
                          speed_mbps: e.target.value === "" ? null : Number(e.target.value),
                        };
                        return { ...p, devices };
                      })
                    }
                  />
                </Field>
                <Field label="Počet datových přípojek">
                  <input
                    type="number"
                    className={inputCls}
                    disabled={disabled}
                    value={row.port_count ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const devices = [...p.devices];
                        devices[idx] = {
                          ...row,
                          port_count: e.target.value === "" ? null : Number(e.target.value),
                        };
                        return { ...p, devices };
                      })
                    }
                  />
                </Field>
                <Field label="PoE?">
                  <select
                    className={inputCls}
                    disabled={disabled}
                    value={row.poe ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const devices = [...p.devices];
                        devices[idx] = { ...row, poe: e.target.value || null };
                        return { ...p, devices };
                      })
                    }
                  >
                    <option value="">—</option>
                    {lookups.yes_no.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Místo připojení">
                  <input
                    className={inputCls}
                    disabled={disabled}
                    value={row.connection_place ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const devices = [...p.devices];
                        devices[idx] = { ...row, connection_place: e.target.value || null };
                        return { ...p, devices };
                      })
                    }
                  />
                </Field>
                <Field label="Max. vzdálenost od switche (m)">
                  <input
                    type="number"
                    className={inputCls}
                    disabled={disabled}
                    value={row.max_distance_m ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const devices = [...p.devices];
                        devices[idx] = {
                          ...row,
                          max_distance_m: e.target.value === "" ? null : Number(e.target.value),
                        };
                        return { ...p, devices };
                      })
                    }
                  />
                </Field>
                <Field
                  label="Požadovaný počet IP"
                  hint="Bez konkrétních adres — přidělí IT"
                >
                  <input
                    type="number"
                    className={inputCls}
                    disabled={disabled}
                    value={row.ip_count ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const devices = [...p.devices];
                        devices[idx] = {
                          ...row,
                          ip_count: e.target.value === "" ? null : Number(e.target.value),
                        };
                        return { ...p, devices };
                      })
                    }
                  />
                </Field>
                <Field label="Preferovaný způsob přidělení IP">
                  <select
                    className={inputCls}
                    disabled={disabled}
                    value={row.allocation_mode ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const devices = [...p.devices];
                        devices[idx] = { ...row, allocation_mode: e.target.value || null };
                        return { ...p, devices };
                      })
                    }
                  >
                    <option value="">—</option>
                    {lookups.allocation_modes.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Poznámka" className="sm:col-span-2 lg:col-span-3">
                  <input
                    className={inputCls}
                    disabled={disabled}
                    value={row.note ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const devices = [...p.devices];
                        devices[idx] = { ...row, note: e.target.value || null };
                        return { ...p, devices };
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          ))}
        </TableSection>
      )}

      {section === 2 && (
        <TableSection
          title="Porty a požadavky na firewall"
          hint="Každý řádek = jedno spojení. Bez účelu nelze pravidlo schválit."
          disabled={disabled}
          onAdd={() =>
            setForm((p) => ({ ...p, firewall_rules: [...p.firewall_rules, emptyFw()] }))
          }
        >
          {form.firewall_rules.map((row, idx) => (
            <div key={idx} className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Spojení {idx + 1}</span>
                {!disabled && form.firewall_rules.length > 1 && (
                  <button
                    type="button"
                    className="text-red-600"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        firewall_rules: p.firewall_rules.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    Odebrat
                  </button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Služba / aplikace">
                  <input
                    className={inputCls}
                    disabled={disabled}
                    value={row.service_name ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const firewall_rules = [...p.firewall_rules];
                        firewall_rules[idx] = { ...row, service_name: e.target.value || null };
                        return { ...p, firewall_rules };
                      })
                    }
                  />
                </Field>
                <Field label="Směr">
                  <select
                    className={inputCls}
                    disabled={disabled}
                    value={row.direction ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const firewall_rules = [...p.firewall_rules];
                        firewall_rules[idx] = { ...row, direction: e.target.value || null };
                        return { ...p, firewall_rules };
                      })
                    }
                  >
                    <option value="">—</option>
                    {lookups.directions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Protokol">
                  <select
                    className={inputCls}
                    disabled={disabled}
                    value={row.protocol ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const firewall_rules = [...p.firewall_rules];
                        firewall_rules[idx] = { ...row, protocol: e.target.value || null };
                        return { ...p, firewall_rules };
                      })
                    }
                  >
                    <option value="">—</option>
                    {lookups.protocols.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cílový port(y)" hint="Např. 443 nebo 8000-8010">
                  <input
                    className={inputCls}
                    disabled={disabled}
                    value={row.target_ports ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const firewall_rules = [...p.firewall_rules];
                        firewall_rules[idx] = { ...row, target_ports: e.target.value || null };
                        return { ...p, firewall_rules };
                      })
                    }
                  />
                </Field>
                <Field label="Zdroj (druh)">
                  <select
                    className={inputCls}
                    disabled={disabled}
                    value={row.source_kind ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const firewall_rules = [...p.firewall_rules];
                        firewall_rules[idx] = { ...row, source_kind: e.target.value || null };
                        return { ...p, firewall_rules };
                      })
                    }
                  >
                    <option value="">—</option>
                    {lookups.source_target_kinds.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Zdroj IP / hostname">
                  <input
                    className={inputCls}
                    disabled={disabled}
                    value={row.source_host ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const firewall_rules = [...p.firewall_rules];
                        firewall_rules[idx] = { ...row, source_host: e.target.value || null };
                        return { ...p, firewall_rules };
                      })
                    }
                  />
                </Field>
                <Field label="Cíl (druh)">
                  <select
                    className={inputCls}
                    disabled={disabled}
                    value={row.target_kind ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const firewall_rules = [...p.firewall_rules];
                        firewall_rules[idx] = { ...row, target_kind: e.target.value || null };
                        return { ...p, firewall_rules };
                      })
                    }
                  >
                    <option value="">—</option>
                    {lookups.source_target_kinds.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cíl IP / FQDN">
                  <input
                    className={inputCls}
                    disabled={disabled}
                    value={row.target_host ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const firewall_rules = [...p.firewall_rules];
                        firewall_rules[idx] = { ...row, target_host: e.target.value || null };
                        return { ...p, firewall_rules };
                      })
                    }
                  />
                </Field>
                <Field label="Šifrované?">
                  <select
                    className={inputCls}
                    disabled={disabled}
                    value={row.encrypted ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const firewall_rules = [...p.firewall_rules];
                        firewall_rules[idx] = { ...row, encrypted: e.target.value || null };
                        return { ...p, firewall_rules };
                      })
                    }
                  >
                    <option value="">—</option>
                    {lookups.encryption_options.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Platnost">
                  <select
                    className={inputCls}
                    disabled={disabled}
                    value={row.validity ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const firewall_rules = [...p.firewall_rules];
                        firewall_rules[idx] = { ...row, validity: e.target.value || null };
                        return { ...p, firewall_rules };
                      })
                    }
                  >
                    <option value="">—</option>
                    {lookups.validity_options.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Účel spojení" className="sm:col-span-2 lg:col-span-3">
                  <textarea
                    className={inputCls}
                    rows={2}
                    disabled={disabled}
                    value={row.purpose ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const firewall_rules = [...p.firewall_rules];
                        firewall_rules[idx] = { ...row, purpose: e.target.value || null };
                        return { ...p, firewall_rules };
                      })
                    }
                  />
                </Field>
                <Field label="Poznámka" className="sm:col-span-2 lg:col-span-3">
                  <input
                    className={inputCls}
                    disabled={disabled}
                    value={row.note ?? ""}
                    onChange={(e) =>
                      setForm((p) => {
                        const firewall_rules = [...p.firewall_rules];
                        firewall_rules[idx] = { ...row, note: e.target.value || null };
                        return { ...p, firewall_rules };
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          ))}
        </TableSection>
      )}

      {section === 3 && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Vyžadujete oddělenou VLAN?"
              hint="Číslo VLAN přidělí IT"
            >
              <select
                className={inputCls}
                disabled={disabled}
                value={form.requested_vlan ?? ""}
                onChange={(e) => set("requested_vlan", e.target.value || null)}
              >
                <option value="">—</option>
                {lookups.yes_no.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Důvod oddělení provozu">
              <input
                className={inputCls}
                disabled={disabled}
                value={form.vlan_reason ?? ""}
                onChange={(e) => set("vlan_reason", e.target.value || null)}
              />
            </Field>
            <Field label="Vyžaduje vzdálený přístup (servis)?">
              <select
                className={inputCls}
                disabled={disabled}
                value={form.remote_access_needed ?? ""}
                onChange={(e) => set("remote_access_needed", e.target.value || null)}
              >
                <option value="">—</option>
                {lookups.yes_no.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Způsob přístupu">
              <select
                className={inputCls}
                disabled={disabled}
                value={form.remote_access_method ?? ""}
                onChange={(e) => set("remote_access_method", e.target.value || null)}
              >
                <option value="">—</option>
                {lookups.remote_access_methods.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Veřejné IP adresy dodavatele" className="sm:col-span-2">
              <textarea
                className={inputCls}
                rows={2}
                disabled={disabled}
                value={form.vendor_public_ips ?? ""}
                onChange={(e) => set("vendor_public_ips", e.target.value || null)}
              />
            </Field>
            <Field label="Technologie obsahuje vlastní router / firewall?">
              <select
                className={inputCls}
                disabled={disabled}
                value={form.has_own_router ?? ""}
                onChange={(e) => set("has_own_router", e.target.value || null)}
              >
                <option value="">—</option>
                {lookups.yes_no_pending.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-gray-900">Kybernetická bezpečnost</h3>
            <div className="space-y-3">
              {form.security_answers.map((row, idx) => (
                <div
                  key={row.question_key}
                  className="grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-3"
                >
                  <div className="text-sm font-medium text-gray-800">
                    {row.label ?? row.question_key}
                  </div>
                  <Field label="Odpověď">
                    <select
                      className={inputCls}
                      disabled={disabled}
                      value={row.answer ?? ""}
                      onChange={(e) =>
                        setForm((p) => {
                          const security_answers = [...p.security_answers];
                          security_answers[idx] = { ...row, answer: e.target.value || null };
                          return { ...p, security_answers };
                        })
                      }
                    >
                      <option value="">—</option>
                      {lookups.yes_no_pending.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Poznámka">
                    <input
                      className={inputCls}
                      disabled={disabled}
                      value={row.note ?? ""}
                      onChange={(e) =>
                        setForm((p) => {
                          const security_answers = [...p.security_answers];
                          security_answers[idx] = { ...row, note: e.target.value || null };
                          return { ...p, security_answers };
                        })
                      }
                    />
                  </Field>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-gray-900">Dokumentace</h3>
            <div className="space-y-3">
              {form.docs.map((row, idx) => (
                <div
                  key={row.doc_key}
                  className="grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-3"
                >
                  <div className="text-sm font-medium text-gray-800">
                    {row.label ?? row.doc_key}
                  </div>
                  <Field label="Dodáno?">
                    <select
                      className={inputCls}
                      disabled={disabled}
                      value={row.delivered ?? ""}
                      onChange={(e) =>
                        setForm((p) => {
                          const docs = [...p.docs];
                          docs[idx] = { ...row, delivered: e.target.value || null };
                          return { ...p, docs };
                        })
                      }
                    >
                      <option value="">—</option>
                      {lookups.yes_no_pending.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Název / odkaz">
                    <input
                      className={inputCls}
                      disabled={disabled}
                      value={row.file_ref ?? ""}
                      onChange={(e) =>
                        setForm((p) => {
                          const docs = [...p.docs];
                          docs[idx] = { ...row, file_ref: e.target.value || null };
                          return { ...p, docs };
                        })
                      }
                    />
                  </Field>
                </div>
              ))}
              <Field label="Další odkazy na dokumentaci (volitelně)">
                <textarea
                  className={inputCls}
                  rows={2}
                  disabled={disabled}
                  value={form.docs_links ?? ""}
                  onChange={(e) => set("docs_links", e.target.value || null)}
                  placeholder="URL nebo názvy souborů"
                />
              </Field>
            </div>
          </div>

          <Field label="Dodavatel – jméno (podpis)">
            <input
              className={inputCls}
              disabled={disabled}
              value={form.vendor_signer_name ?? ""}
              onChange={(e) => set("vendor_signer_name", e.target.value || null)}
            />
          </Field>
          {mode === "vendor" && (
            <p className="text-sm text-gray-600">
              Odesláním potvrzujete správnost údajů. IP adresy a VLAN přidělí IT dodatečně.
            </p>
          )}
        </div>
      )}

      {section === 4 && mode === "internal" && (
        <div className="space-y-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
          <div>
            <h3 className="font-semibold text-slate-900">Přidělení sítě (vyplňuje IT)</h3>
            <p className="text-sm text-slate-600">
              Konkrétní VLAN a IP adresy. Dodavatel je přes odkaz nevidí.
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
                Oranžové = dodavatel (jen čtení)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700">
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-500" />
                Šedé = vyplňuje IT
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              VLAN a IP berou z registru{" "}
              <Link href="/pozadavky?tab=sit" className="underline hover:text-slate-900">
                Síť / IP
              </Link>
              . Kolize s jiným dodavatelem uložení zablokuje.
            </p>
          </div>

          <div className="grid gap-4 rounded-lg border border-slate-300 bg-white p-4 sm:grid-cols-2">
            <Field
              label="Přiřazená VLAN"
              hint={
                vlans.length === 0
                  ? "Nejdřív založte VLAN v záložce Síť / IP"
                  : undefined
              }
            >
              <select
                className={itInputCls}
                disabled={disabled || vlans.length === 0}
                value={form.assigned_vlan_id ?? ""}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  const v = vlans.find((x) => x.id === id);
                  setForm((p) => ({
                    ...p,
                    assigned_vlan_id: id,
                    assigned_vlan: v ? `VLAN ${v.vlan_number} – ${v.name}` : null,
                  }));
                }}
              >
                <option value="">— vyberte VLAN —</option>
                {vlans
                  .filter((v) => v.active)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      VLAN {v.vlan_number} – {v.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="IT síťové poznámky" className="sm:col-span-2">
              <textarea
                className={itInputCls}
                rows={2}
                disabled={disabled}
                value={form.it_network_notes ?? ""}
                onChange={(e) => set("it_network_notes", e.target.value || null)}
              />
            </Field>
            <Field label="Interní poznámky" className="sm:col-span-2">
              <textarea
                className={itInputCls}
                rows={2}
                disabled={disabled}
                value={form.internal_notes ?? ""}
                onChange={(e) => set("internal_notes", e.target.value || null)}
              />
            </Field>
            <Field label="Vedoucí projektu – jméno">
              <input
                className={itInputCls}
                disabled={disabled}
                value={form.pm_name ?? ""}
                onChange={(e) => set("pm_name", e.target.value || null)}
              />
            </Field>
            <Field label="IT oddělení – jméno">
              <input
                className={itInputCls}
                disabled={disabled}
                value={form.it_name ?? ""}
                onChange={(e) => set("it_name", e.target.value || null)}
              />
            </Field>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">
              Zařízení – rozsah IP
            </h4>
            <div className="space-y-3">
              {form.devices.map((row, idx) => (
                <div key={idx} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                  <VendorReadonly title="Dodavatel">
                    <div className="font-medium">
                      {row.device_group || `Zařízení ${idx + 1}`}
                    </div>
                    <div className="mt-1 grid gap-1 text-xs sm:grid-cols-2">
                      <div>Rozhraní: {row.interface_type || "—"}</div>
                      <div>Přípojky: {row.port_count ?? "—"}</div>
                      <div>
                        Požadavek IP:{" "}
                        {row.ip_count != null
                          ? `${row.ip_count}× ${row.allocation_mode || "IP"}`
                          : "—"}
                      </div>
                      <div>PoE: {row.poe || "—"}</div>
                      {row.note ? (
                        <div className="sm:col-span-2">Poznámka: {row.note}</div>
                      ) : null}
                    </div>
                  </VendorReadonly>
                  <div className="grid gap-2 rounded-lg border border-slate-300 bg-slate-50 p-3 sm:grid-cols-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 sm:col-span-4">
                      IT – přidělený rozsah
                    </div>
                    <Field
                      label="IP od"
                      hint={
                        rangeChoices.length === 0
                          ? "Vyberte VLAN se subnetem (volné IP)"
                          : undefined
                      }
                    >
                      <select
                        className={itInputCls}
                        disabled={disabled || rangeChoices.length === 0}
                        value={row.assigned_ip_from ?? ""}
                        onChange={(e) =>
                          setForm((p) => {
                            const devices = [...p.devices];
                            const val = e.target.value || null;
                            devices[idx] = {
                              ...row,
                              assigned_ip_from: val,
                              assigned_ip_to: row.assigned_ip_to || val,
                            };
                            return { ...p, devices };
                          })
                        }
                      >
                        <option value="">— vyberte —</option>
                        {rangeChoices.map((ip) => (
                          <option key={ip} value={ip}>
                            {ip}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="IP do">
                      <select
                        className={itInputCls}
                        disabled={disabled || rangeChoices.length === 0}
                        value={row.assigned_ip_to ?? ""}
                        onChange={(e) =>
                          setForm((p) => {
                            const devices = [...p.devices];
                            devices[idx] = {
                              ...row,
                              assigned_ip_to: e.target.value || null,
                            };
                            return { ...p, devices };
                          })
                        }
                      >
                        <option value="">— vyberte —</option>
                        {rangeChoices.map((ip) => (
                          <option key={ip} value={ip}>
                            {ip}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Poznámka IT" className="sm:col-span-2">
                      <input
                        className={itInputCls}
                        disabled={disabled}
                        value={row.assigned_note ?? ""}
                        onChange={(e) =>
                          setForm((p) => {
                            const devices = [...p.devices];
                            devices[idx] = { ...row, assigned_note: e.target.value || null };
                            return { ...p, devices };
                          })
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">
              Firewall – IP ke službě / portu
            </h4>
            <p className="mb-2 text-xs text-slate-600">
              Jedno zařízení s více porty = stejná IP u více řádků. Vyberte IP ze seznamu
              podle rozsahu výše.
            </p>
            <div className="space-y-3">
              {form.firewall_rules
                .filter((r) => r.service_name || r.target_ports || r.purpose)
                .map((row, idx) => {
                  const realIdx = form.firewall_rules.indexOf(row);
                  const currentIp = (row.assigned_ip ?? "").trim();
                  const options =
                    currentIp && !firewallIpChoices.includes(currentIp)
                      ? [...firewallIpChoices, currentIp]
                      : firewallIpChoices;
                  return (
                    <div
                      key={realIdx}
                      className="space-y-2 rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <VendorReadonly title="Dodavatel">
                        <div className="font-medium">
                          {row.service_name || `Pravidlo ${idx + 1}`}
                          {row.target_ports ? ` · port ${row.target_ports}` : ""}
                        </div>
                        <div className="mt-1 grid gap-1 text-xs sm:grid-cols-2">
                          <div>Směr: {row.direction || "—"}</div>
                          <div>Protokol: {row.protocol || "—"}</div>
                          <div>Zdroj: {[row.source_kind, row.source_host].filter(Boolean).join(" ") || "—"}</div>
                          <div>Cíl: {[row.target_kind, row.target_host].filter(Boolean).join(" ") || "—"}</div>
                          {row.purpose ? (
                            <div className="sm:col-span-2">Účel: {row.purpose}</div>
                          ) : null}
                          {row.note ? (
                            <div className="sm:col-span-2">Poznámka: {row.note}</div>
                          ) : null}
                        </div>
                      </VendorReadonly>
                      <div className="grid gap-2 rounded-lg border border-slate-300 bg-slate-50 p-3 sm:grid-cols-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 sm:col-span-4">
                          IT – přidělení
                        </div>
                        <Field
                          label="Přidělená IP"
                          hint={
                            options.length === 0
                              ? "Nejdřív zvolte rozsah IP výše (z volných v registru)"
                              : undefined
                          }
                        >
                          <select
                            className={itInputCls}
                            disabled={disabled || options.length === 0}
                            value={currentIp}
                            onChange={(e) =>
                              setForm((p) => {
                                const firewall_rules = [...p.firewall_rules];
                                firewall_rules[realIdx] = {
                                  ...row,
                                  assigned_ip: e.target.value || null,
                                };
                                return { ...p, firewall_rules };
                              })
                            }
                          >
                            <option value="">— vyberte IP —</option>
                            {options.map((ip) => (
                              <option key={ip} value={ip}>
                                {ip}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Implementováno">
                          <label className="flex h-[38px] items-center gap-2 text-sm text-slate-800">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              disabled={disabled}
                              checked={Boolean(row.implemented)}
                              onChange={(e) =>
                                setForm((p) => {
                                  const firewall_rules = [...p.firewall_rules];
                                  firewall_rules[realIdx] = {
                                    ...row,
                                    implemented: e.target.checked,
                                  };
                                  return { ...p, firewall_rules };
                                })
                              }
                            />
                            Ano
                          </label>
                        </Field>
                        <Field label="Poznámka IT" className="sm:col-span-2">
                          <input
                            className={itInputCls}
                            disabled={disabled}
                            value={row.assigned_note ?? ""}
                            onChange={(e) =>
                              setForm((p) => {
                                const firewall_rules = [...p.firewall_rules];
                                firewall_rules[realIdx] = {
                                  ...row,
                                  assigned_note: e.target.value || null,
                                };
                                return { ...p, firewall_rules };
                              })
                            }
                          />
                        </Field>
                      </div>
                    </div>
                  );
                })}
              {form.firewall_rules.every(
                (r) => !r.service_name && !r.target_ports && !r.purpose
              ) && (
                <p className="text-sm text-slate-500">Žádná firewall pravidla od dodavatele.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <button
          type="button"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
          disabled={section === 0}
          onClick={() => onSectionChange(section - 1)}
        >
          ← Předchozí
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {onSave && section === maxSection && (
            <button
              type="button"
              disabled={disabled || Boolean(saving)}
              onClick={() => onSave()}
              className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? "Ukládám…" : "Uložit"}
            </button>
          )}
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
            disabled={section >= maxSection}
            onClick={() => onSectionChange(section + 1)}
          >
            Další →
          </button>
        </div>
      </div>
    </div>
  );
}

function TableSection({
  title,
  hint,
  children,
  onAdd,
  disabled,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  onAdd: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={onAdd}
            className="shrink-0 rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
          >
            + Přidat řádek
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

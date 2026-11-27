"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Network, Pencil, Plus, RefreshCw } from "lucide-react";

const DEVICE_KINDS = [
  "Server",
  "Tiskárna",
  "AP / Wi‑Fi",
  "Kamera",
  "Switch",
  "Router / FW",
  "Workstation",
  "PLC / OT",
  "Jiné",
] as const;

type SubnetStat = {
  id: number;
  cidr: string;
  gateway: string | null;
  note: string | null;
  total: number;
  free: number;
  allocated: number;
};

type VlanItem = {
  id: number;
  vlan_number: number;
  name: string;
  description: string | null;
  active: boolean;
  subnets: SubnetStat[];
};

type IpItem = {
  id: number;
  ip_address: string;
  status: string;
  device_kind: string | null;
  label: string | null;
  description: string | null;
  subnet: { id: number; cidr: string; vlan: { id: number; vlan_number: number; name: string } };
  request: {
    id: number;
    request_number: string;
    vendor_company: string | null;
    project_name: string | null;
  } | null;
  ports: {
    id: number;
    protocol: string | null;
    port: string | null;
    service_name: string | null;
    direction: string | null;
  }[];
};

export function SitIpTab() {
  const [vlans, setVlans] = useState<VlanItem[]>([]);
  const [ips, setIps] = useState<IpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [vlanNumber, setVlanNumber] = useState("");
  const [vlanName, setVlanName] = useState("");
  const [vlanDesc, setVlanDesc] = useState("");

  const [subnetVlanId, setSubnetVlanId] = useState("");
  const [cidr, setCidr] = useState("");
  const [gateway, setGateway] = useState("");

  const [filterVlan, setFilterVlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterQ, setFilterQ] = useState("");

  const [editIp, setEditIp] = useState<IpItem | null>(null);
  const [editKind, setEditKind] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  /** VLAN id → rozbaleno v přehledu IP */
  const [expandedVlans, setExpandedVlans] = useState<Record<number, boolean>>({});

  const loadVlans = useCallback(async () => {
    const res = await fetch("/api/it-network/vlans");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Nelze načíst VLAN");
    setVlans(data.items ?? []);
  }, []);

  const loadIps = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterVlan !== "all") params.set("vlan_id", filterVlan);
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterQ.trim()) params.set("q", filterQ.trim());
    const res = await fetch(`/api/it-network/ips?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Nelze načíst IP");
    setIps(data.items ?? []);
  }, [filterVlan, filterStatus, filterQ]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadVlans(), loadIps()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba načtení");
    }
    setLoading(false);
  }, [loadVlans, loadIps]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createVlan = async () => {
    setMsg("");
    setError("");
    const res = await fetch("/api/it-network/vlans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vlan_number: Number(vlanNumber),
        name: vlanName,
        description: vlanDesc || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "VLAN se nepodařilo vytvořit");
      return;
    }
    setVlanNumber("");
    setVlanName("");
    setVlanDesc("");
    setMsg(`VLAN ${data.item.vlan_number} vytvořena`);
    await loadVlans();
  };

  const ipsByVlan = useMemo(() => {
    const map = new Map<
      number,
      {
        vlan_number: number;
        name: string;
        cidrs: string[];
        free: number;
        allocated: number;
        items: IpItem[];
      }
    >();
    for (const ip of ips) {
      const v = ip.subnet.vlan;
      let g = map.get(v.id);
      if (!g) {
        g = {
          vlan_number: v.vlan_number,
          name: v.name,
          cidrs: [],
          free: 0,
          allocated: 0,
          items: [],
        };
        map.set(v.id, g);
      }
      g.items.push(ip);
      if (!g.cidrs.includes(ip.subnet.cidr)) g.cidrs.push(ip.subnet.cidr);
      if (ip.status === "free") g.free += 1;
      else g.allocated += 1;
    }
    return [...map.entries()].sort((a, b) => a[1].vlan_number - b[1].vlan_number);
  }, [ips]);

  useEffect(() => {
    if (filterVlan !== "all") {
      const id = Number(filterVlan);
      if (Number.isFinite(id)) {
        setExpandedVlans((prev) => ({ ...prev, [id]: true }));
      }
    }
  }, [filterVlan]);

  // Při hledání rozbal skupiny, ať je výsledek vidět
  useEffect(() => {
    if (!filterQ.trim() || ipsByVlan.length === 0) return;
    const next: Record<number, boolean> = {};
    for (const [id] of ipsByVlan) next[id] = true;
    setExpandedVlans(next);
  }, [filterQ, ipsByVlan]);

  const toggleVlan = (vlanId: number) => {
    setExpandedVlans((prev) => ({ ...prev, [vlanId]: !prev[vlanId] }));
  };

  const expandAll = () => {
    const next: Record<number, boolean> = {};
    for (const [id] of ipsByVlan) next[id] = true;
    setExpandedVlans(next);
  };

  const collapseAll = () => setExpandedVlans({});

  const openEdit = (ip: IpItem) => {
    setEditIp(ip);
    setEditKind(ip.device_kind || "");
    setEditLabel(ip.label || "");
    setEditDesc(ip.description || "");
    setError("");
    setMsg("");
  };

  const saveEdit = async (release = false) => {
    if (!editIp) return;
    setEditSaving(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch(`/api/it-network/ips/${editIp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          release
            ? { release: true }
            : {
                device_kind: editKind || null,
                label: editLabel || null,
                description: editDesc || null,
              }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Uložení IP selhalo");
      } else {
        setMsg(
          release
            ? `IP ${editIp.ip_address} uvolněna`
            : `IP ${editIp.ip_address} uložena`
        );
        setEditIp(null);
        await loadIps();
        await loadVlans();
      }
    } catch {
      setError("Chyba sítě");
    }
    setEditSaving(false);
  };

  const createSubnet = async () => {
    setMsg("");
    setError("");
    const res = await fetch("/api/it-network/subnets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vlan_id: Number(subnetVlanId),
        cidr,
        gateway: gateway || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Subnet se nepodařilo vytvořit");
      return;
    }
    setCidr("");
    setGateway("");
    setMsg(`Subnet ${data.item.cidr} založen (IP generovány jako volné)`);
    await reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Network className="h-5 w-5 text-slate-700" />
            Síť / IP registr
          </h2>
          <p className="text-sm text-gray-600">
            Katalog VLAN a subnetů, přehled volných a přidělených adres (včetně portů z
            požadavků dodavatelů).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Obnovit
        </button>
      </div>

      {(error || msg) && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {error || msg}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="font-semibold text-gray-900">Nová VLAN</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Číslo VLAN</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={vlanNumber}
                onChange={(e) => setVlanNumber(e.target.value)}
                placeholder="220"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Název</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={vlanName}
                onChange={(e) => setVlanName(e.target.value)}
                placeholder="Technologie"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Popis</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={vlanDesc}
                onChange={(e) => setVlanDesc(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void createVlan()}
            disabled={!vlanNumber || !vlanName.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Přidat VLAN
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="font-semibold text-gray-900">Nový subnet</h3>
          <p className="text-xs text-gray-500">
            Při založení se vygenerují volné host IP (max /22). Network a broadcast se
            nevyužívají.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">VLAN</span>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={subnetVlanId}
                onChange={(e) => setSubnetVlanId(e.target.value)}
              >
                <option value="">— vyberte —</option>
                {vlans.map((v) => (
                  <option key={v.id} value={v.id}>
                    VLAN {v.vlan_number} – {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">CIDR</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={cidr}
                onChange={(e) => setCidr(e.target.value)}
                placeholder="192.168.220.0/24"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Gateway</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={gateway}
                onChange={(e) => setGateway(e.target.value)}
                placeholder="192.168.220.1"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void createSubnet()}
            disabled={!subnetVlanId || !cidr.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Přidat subnet
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-gray-900">VLAN a subnety</h3>
        {loading && !vlans.length ? (
          <p className="text-sm text-gray-500">Načítání…</p>
        ) : vlans.length === 0 ? (
          <p className="text-sm text-gray-500">Zatím žádné VLAN – založte první výše.</p>
        ) : (
          <div className="space-y-3">
            {vlans.map((v) => (
              <div key={v.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="font-medium text-gray-900">
                  VLAN {v.vlan_number} – {v.name}
                  {!v.active ? (
                    <span className="ml-2 text-xs text-gray-500">(neaktivní)</span>
                  ) : null}
                </div>
                {v.description ? (
                  <p className="text-xs text-gray-600">{v.description}</p>
                ) : null}
                {v.subnets.length === 0 ? (
                  <p className="mt-1 text-xs text-gray-500">Bez subnetu</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {v.subnets.map((s) => (
                      <li key={s.id} className="flex flex-wrap gap-x-3 gap-y-1">
                        <span className="font-mono">{s.cidr}</span>
                        <span className="text-green-700">volných {s.free}</span>
                        <span className="text-amber-700">přidělených {s.allocated}</span>
                        <span className="text-gray-500">celkem {s.total}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900">Přehled IP</h3>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={expandAll}
              className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-50"
            >
              Rozbalit vše
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-50"
            >
              Sbalit vše
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={filterVlan}
            onChange={(e) => setFilterVlan(e.target.value)}
          >
            <option value="all">Všechny VLAN</option>
            {vlans.map((v) => (
              <option key={v.id} value={v.id}>
                VLAN {v.vlan_number}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Všechny stavy</option>
            <option value="free">Volné</option>
            <option value="allocated">Přidělené</option>
          </select>
          <input
            className="min-w-[160px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Hledat IP…"
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void loadIps();
            }}
          />
        </div>

        {ipsByVlan.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Žádné IP podle filtru</p>
        ) : (
          <div className="space-y-2">
            {ipsByVlan.map(([vlanId, group]) => {
              const open = Boolean(expandedVlans[vlanId]);
              return (
                <div
                  key={vlanId}
                  className="overflow-hidden rounded-lg border border-gray-200"
                >
                  <button
                    type="button"
                    onClick={() => toggleVlan(vlanId)}
                    className="flex w-full items-center gap-2 bg-gray-50 px-3 py-2.5 text-left hover:bg-gray-100"
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
                    )}
                    <span className="font-medium text-gray-900">
                      VLAN {group.vlan_number} – {group.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {group.cidrs.join(", ")}
                    </span>
                    <span className="ml-auto flex flex-wrap gap-2 text-xs">
                      <span className="text-green-700">volných {group.free}</span>
                      <span className="text-amber-700">přidělených {group.allocated}</span>
                      <span className="text-gray-500">celkem {group.items.length}</span>
                    </span>
                  </button>

                  {open && (
                    <div className="overflow-x-auto border-t border-gray-200">
                      <table className="min-w-full text-left text-sm">
                        <thead className="border-b bg-white text-xs uppercase text-gray-500">
                          <tr>
                            <th className="px-3 py-2">IP</th>
                            <th className="px-3 py-2">Stav</th>
                            <th className="px-3 py-2">Typ / název</th>
                            <th className="px-3 py-2">Požadavek</th>
                            <th className="px-3 py-2">Porty / služby</th>
                            <th className="px-3 py-2 text-right">Akce</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((ip) => (
                            <tr
                              key={ip.id}
                              className="border-b last:border-0 hover:bg-gray-50"
                            >
                              <td className="px-3 py-2 font-mono">{ip.ip_address}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                    ip.status === "free"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-amber-100 text-amber-900"
                                  }`}
                                >
                                  {ip.status === "free" ? "Volná" : "Přidělená"}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {ip.device_kind || ip.label ? (
                                  <div>
                                    <div className="font-medium text-gray-900">
                                      {[ip.device_kind, ip.label]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </div>
                                    {ip.description ? (
                                      <div className="line-clamp-2 text-xs text-gray-500">
                                        {ip.description}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {ip.request ? (
                                  <Link
                                    href={`/pozadavky/externi/${ip.request.id}`}
                                    className="text-red-600 hover:underline"
                                  >
                                    {ip.request.request_number}
                                    {ip.request.vendor_company
                                      ? ` · ${ip.request.vendor_company}`
                                      : ""}
                                  </Link>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-700">
                                {ip.ports.length
                                  ? ip.ports
                                      .map(
                                        (p) =>
                                          `${p.service_name || "služba"}${
                                            p.port ? `:${p.port}` : ""
                                          }${p.protocol ? `/${p.protocol}` : ""}`
                                      )
                                      .join("; ")
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  title="Přidělit / upravit"
                                  onClick={() => openEdit(ip)}
                                  className="inline-flex rounded-md p-1.5 text-gray-500 hover:bg-slate-100 hover:text-slate-800"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editIp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Přidělení IP {editIp.ip_address}
            </h3>
            <p className="text-xs text-gray-500">
              VLAN {editIp.subnet.vlan.vlan_number} · {editIp.subnet.cidr}
              {editIp.request
                ? ` · vázáno na ${editIp.request.request_number}`
                : ""}
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Typ zařízení</span>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={editKind}
                onChange={(e) => setEditKind(e.target.value)}
              >
                <option value="">— vyberte —</option>
                {DEVICE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Název</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="např. srv-sql-01, HP-Office"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Popis</span>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Umístění, účel…"
              />
            </label>
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <button
                type="button"
                disabled={editSaving || Boolean(editIp.request)}
                onClick={() => void saveEdit(true)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                title={
                  editIp.request
                    ? "IP z požadavku uvolníte úpravou požadavku"
                    : "Uvolnit IP"
                }
              >
                Uvolnit
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => setEditIp(null)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  Zrušit
                </button>
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => void saveEdit(false)}
                  className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {editSaving ? "Ukládám…" : "Uložit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

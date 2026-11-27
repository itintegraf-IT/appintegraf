import { detailInclude, serializeInternal } from "@/lib/it-vendor-request/serialize";
import {
  IT_VENDOR_STATUS_LABELS,
  type ItVendorStatus,
} from "@/lib/it-vendor-request/lookups";
import { prisma } from "@/lib/db";

export type ItVendorReportData = ReturnType<typeof serializeInternal> & {
  status_label: string;
};

export async function loadItVendorReport(id: number): Promise<ItVendorReportData | null> {
  const row = await prisma.it_vendor_requests.findUnique({
    where: { id },
    include: detailInclude,
  });
  if (!row) return null;
  const item = serializeInternal(row);
  const status = item.status as ItVendorStatus;
  return {
    ...item,
    status_label: IT_VENDOR_STATUS_LABELS[status] ?? item.status,
  };
}

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cell(v: string | null | undefined): string {
  const t = (v ?? "").trim();
  return t ? esc(t) : "—";
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("cs-CZ");
  } catch {
    return iso.slice(0, 10);
  }
}

function ipRange(from: string | null | undefined, to: string | null | undefined): string {
  if (from && to && from !== to) return `${from} – ${to}`;
  return from || to || "—";
}

/** HTML tabulka reportu (e-mail i tisk). */
export function buildItVendorReportHtml(data: ItVendorReportData): string {
  const deviceRows = data.interfaces
    .map((iface, i) => {
      const ip = data.ips[i];
      return `<tr>
        <td>${cell(iface.device_group || ip?.device_service)}</td>
        <td>${cell(iface.interface_type)}</td>
        <td style="text-align:center">${iface.port_count ?? "—"}</td>
        <td style="text-align:center">${ip?.ip_count ?? "—"}</td>
        <td>${cell(ip?.allocation_mode)}</td>
        <td><strong>${esc(ipRange(ip?.assigned_ip_from, ip?.assigned_ip_to))}</strong></td>
        <td>${cell(ip?.assigned_note)}</td>
      </tr>`;
    })
    .join("");

  const fwRows = data.firewall_rules
    .filter((r) => r.service_name || r.target_ports || r.purpose)
    .map(
      (r) => `<tr>
        <td>${cell(r.service_name)}</td>
        <td>${cell(r.direction)}</td>
        <td>${cell(r.protocol)}</td>
        <td>${cell(r.target_ports)}</td>
        <td>${cell(r.purpose)}</td>
        <td><strong>${cell(r.assigned_ip)}</strong></td>
        <td style="text-align:center">${r.implemented ? "Ano" : "Ne"}</td>
        <td>${cell(r.assigned_note)}</td>
      </tr>`
    )
    .join("");

  const contactRows = (data.contacts?.length
    ? data.contacts
    : [
        {
          role: null as string | null,
          name: data.contact_name,
          phone: data.contact_phone,
          email: data.contact_email,
        },
      ]
  )
    .filter((c) => c.name || c.email || c.phone)
    .map(
      (c) => `<tr>
        <td>${cell(c.role)}</td>
        <td>${cell(c.name)}</td>
        <td>${cell(c.phone)}</td>
        <td>${cell(c.email)}</td>
      </tr>`
    )
    .join("");

  return `
<div style="font-family:Arial,sans-serif;color:#111;font-size:14px;line-height:1.45">
  <h1 style="font-size:20px;margin:0 0 8px">INTEGRAF – IT síťový report</h1>
  <p style="margin:0 0 16px;color:#444">Přehled přidělených síťových parametrů pro dodavatele</p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <tr><td style="padding:4px 8px;width:180px;color:#555">Evidenční číslo</td><td style="padding:4px 8px"><strong>${esc(data.request_number)}</strong></td></tr>
    <tr><td style="padding:4px 8px;color:#555">Stav</td><td style="padding:4px 8px">${esc(data.status_label)}</td></tr>
    <tr><td style="padding:4px 8px;color:#555">Projekt / technologie</td><td style="padding:4px 8px">${cell(data.project_name)}</td></tr>
    <tr><td style="padding:4px 8px;color:#555">Dodavatel</td><td style="padding:4px 8px">${cell(data.vendor_company)}</td></tr>
    <tr><td style="padding:4px 8px;color:#555">Místo instalace</td><td style="padding:4px 8px">${cell(data.install_location)}</td></tr>
    <tr><td style="padding:4px 8px;color:#555">Schváleno</td><td style="padding:4px 8px">${fmtDate(data.approved_at)}</td></tr>
    <tr><td style="padding:4px 8px;color:#555">Přiřazená VLAN</td><td style="padding:4px 8px"><strong>${cell(data.assigned_vlan)}</strong></td></tr>
    ${
      data.it_network_notes
        ? `<tr><td style="padding:4px 8px;color:#555">Poznámky IT</td><td style="padding:4px 8px">${esc(data.it_network_notes)}</td></tr>`
        : ""
    }
  </table>

  <h2 style="font-size:16px;margin:20px 0 8px">Kontakty</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;border:1px solid #ddd">
    <thead>
      <tr style="background:#f3f4f6">
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Role</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Jméno</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Telefon</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">E-mail</th>
      </tr>
    </thead>
    <tbody>${contactRows || `<tr><td colspan="4" style="padding:8px;border:1px solid #ddd">—</td></tr>`}</tbody>
  </table>

  <h2 style="font-size:16px;margin:20px 0 8px">Zařízení a přidělené IP</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;border:1px solid #ddd;font-size:13px">
    <thead>
      <tr style="background:#f3f4f6">
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Zařízení</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Rozhraní</th>
        <th style="border:1px solid #ddd;padding:6px 8px">Přípojky</th>
        <th style="border:1px solid #ddd;padding:6px 8px">Požadavek IP</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Způsob</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Přidělené IP</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Poznámka IT</th>
      </tr>
    </thead>
    <tbody>${deviceRows || `<tr><td colspan="7" style="padding:8px;border:1px solid #ddd">Žádná zařízení</td></tr>`}</tbody>
  </table>

  <h2 style="font-size:16px;margin:20px 0 8px">Firewall pravidla</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;border:1px solid #ddd;font-size:13px">
    <thead>
      <tr style="background:#f3f4f6">
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Služba</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Směr</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Protokol</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Porty</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Účel</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Přidělená IP</th>
        <th style="border:1px solid #ddd;padding:6px 8px">Implementováno</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Poznámka IT</th>
      </tr>
    </thead>
    <tbody>${fwRows || `<tr><td colspan="8" style="padding:8px;border:1px solid #ddd">Žádná pravidla</td></tr>`}</tbody>
  </table>

  <h2 style="font-size:16px;margin:20px 0 8px">Schválení</h2>
  <table style="width:100%;border-collapse:collapse;border:1px solid #ddd">
    <thead>
      <tr style="background:#f3f4f6">
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Role</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Jméno</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left">Datum</th>
      </tr>
    </thead>
    <tbody>
      <tr><td style="border:1px solid #ddd;padding:6px 8px">Dodavatel</td><td style="border:1px solid #ddd;padding:6px 8px">${cell(data.vendor_signer_name)}</td><td style="border:1px solid #ddd;padding:6px 8px">${fmtDate(data.vendor_signed_at)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:6px 8px">Vedoucí projektu</td><td style="border:1px solid #ddd;padding:6px 8px">${cell(data.pm_name)}</td><td style="border:1px solid #ddd;padding:6px 8px">${fmtDate(data.pm_signed_at)}</td></tr>
      <tr><td style="border:1px solid #ddd;padding:6px 8px">IT oddělení</td><td style="border:1px solid #ddd;padding:6px 8px">${cell(data.it_name)}</td><td style="border:1px solid #ddd;padding:6px 8px">${fmtDate(data.it_signed_at)}</td></tr>
    </tbody>
  </table>
</div>`.trim();
}

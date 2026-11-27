import type {
  it_vendor_requests,
  it_vendor_request_interfaces,
  it_vendor_request_ips,
  it_vendor_request_firewall_rules,
  it_vendor_request_protocols,
  it_vendor_request_security,
  it_vendor_request_docs,
  it_vendor_request_contacts,
} from "@prisma/client";
import { DOC_CATALOG, PROTOCOL_CATALOG, SECURITY_QUESTIONS } from "@/lib/it-vendor-request/lookups";

export type ItVendorRequestFull = it_vendor_requests & {
  interfaces: it_vendor_request_interfaces[];
  ips: it_vendor_request_ips[];
  firewall_rules: it_vendor_request_firewall_rules[];
  protocols: it_vendor_request_protocols[];
  security_answers: it_vendor_request_security[];
  docs: it_vendor_request_docs[];
  contacts?: it_vendor_request_contacts[];
  users_created?: { id: number; first_name: string; last_name: string; email: string } | null;
  links?: {
    id: number;
    sent_to_email: string;
    expires_at: Date;
    revoked_at: Date | null;
    created_at: Date;
  }[];
};

function dateOnly(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function iso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

/** Plný detail pro interní UI (včetně IT polí). */
export function serializeInternal(row: ItVendorRequestFull) {
  return {
    id: row.id,
    request_number: row.request_number,
    status: row.status,
    request_date: dateOnly(row.request_date),
    due_date: dateOnly(row.due_date),
    project_name: row.project_name,
    vendor_company: row.vendor_company,
    contact_name: row.contact_name,
    contact_phone: row.contact_phone,
    contact_email: row.contact_email,
    device_vendor_type: row.device_vendor_type,
    install_location: row.install_location,
    preferred_network_placement: row.preferred_network_placement,
    purpose: row.purpose,
    tech_description: row.tech_description,
    requested_services: row.requested_services,
    connection_type: row.connection_type,
    devices_needing_ip: row.devices_needing_ip,
    dhcp_mode: row.dhcp_mode,
    requested_ip_range: row.requested_ip_range,
    notes: row.notes,
    requested_vlan: row.requested_vlan,
    vlan_reason: row.vlan_reason,
    remote_access_needed: row.remote_access_needed,
    remote_access_method: row.remote_access_method,
    vendor_public_ips: row.vendor_public_ips,
    has_own_router: row.has_own_router,
    internal_notes: row.internal_notes,
    assigned_vlan: row.assigned_vlan,
    assigned_vlan_id: row.assigned_vlan_id,
    it_network_notes: row.it_network_notes,
    rejection_reason: row.rejection_reason,
    vendor_signer_name: row.vendor_signer_name,
    vendor_signed_at: iso(row.vendor_signed_at),
    pm_name: row.pm_name,
    pm_signed_at: iso(row.pm_signed_at),
    it_name: row.it_name,
    it_signed_at: iso(row.it_signed_at),
    assigned_it_user_id: row.assigned_it_user_id,
    created_by: row.created_by,
    submitted_at: iso(row.submitted_at),
    approved_at: iso(row.approved_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    created_by_user: row.users_created
      ? {
          id: row.users_created.id,
          name: `${row.users_created.first_name} ${row.users_created.last_name}`.trim(),
          email: row.users_created.email,
        }
      : null,
    interfaces: row.interfaces.map((r) => ({
      id: r.id,
      device_group: r.device_group,
      interface_type: r.interface_type,
      speed_mbps: r.speed_mbps,
      port_count: r.port_count,
      poe: r.poe,
      requested_vlan: r.requested_vlan,
      connection_place: r.connection_place,
      max_distance_m: r.max_distance_m,
      note: r.note,
    })),
    ips: row.ips.map((r) => ({
      id: r.id,
      device_service: r.device_service,
      allocation_mode: r.allocation_mode,
      ip_count: r.ip_count,
      ip_from: r.ip_from,
      ip_to: r.ip_to,
      mask_cidr: r.mask_cidr,
      gateway: r.gateway,
      dns: r.dns,
      mac_address: r.mac_address,
      note: r.note,
      assigned_ip_from: r.assigned_ip_from,
      assigned_ip_to: r.assigned_ip_to,
      assigned_note: r.assigned_note,
    })),
    firewall_rules: row.firewall_rules.map((r) => ({
      id: r.id,
      service_name: r.service_name,
      source_kind: r.source_kind,
      source_host: r.source_host,
      target_kind: r.target_kind,
      target_host: r.target_host,
      protocol: r.protocol,
      target_ports: r.target_ports,
      direction: r.direction,
      purpose: r.purpose,
      encrypted: r.encrypted,
      validity: r.validity,
      note: r.note,
      implemented: r.implemented,
      assigned_ip: r.assigned_ip,
      assigned_note: r.assigned_note,
    })),
    protocols: mergeProtocols(row.protocols),
    security_answers: mergeSecurity(row.security_answers),
    docs: mergeDocs(row.docs),
    contacts: (row.contacts ?? []).map((c) => ({
      id: c.id,
      role: c.role,
      name: c.name,
      phone: c.phone,
      email: c.email,
    })),
    links: (row.links ?? []).map((l) => ({
      id: l.id,
      sent_to_email: l.sent_to_email,
      expires_at: iso(l.expires_at),
      revoked_at: iso(l.revoked_at),
      created_at: iso(l.created_at),
      active: !l.revoked_at && l.expires_at.getTime() > Date.now(),
    })),
    summary: {
      port_count: row.interfaces.reduce((s, r) => s + (r.port_count ?? 0), 0),
      ip_count: row.ips.reduce((s, r) => s + (r.ip_count ?? 0), 0),
      firewall_count: row.firewall_rules.filter((r) => r.service_name).length,
    },
  };
}

const PUBLIC_DOC_KEYS = new Set(["network_schema", "technical_docs"]);

/** Veřejný payload – bez IT-only polí a bez konkrétních IP/VLAN čísel od IT. */
export function serializePublic(row: ItVendorRequestFull) {
  const full = serializeInternal(row);
  return {
    request_number: full.request_number,
    status: full.status,
    editable: full.status === "sent",
    due_date: full.due_date,
    project_name: full.project_name,
    vendor_company: full.vendor_company,
    contact_name: full.contact_name,
    contact_phone: full.contact_phone,
    contact_email: full.contact_email,
    contacts: full.contacts.map(({ id: _id, ...rest }) => {
      void _id;
      return rest;
    }),
    device_vendor_type: full.device_vendor_type,
    install_location: full.install_location,
    purpose: full.purpose,
    tech_description: full.tech_description,
    requested_services: full.requested_services,
    notes: full.notes,
    requested_vlan: full.requested_vlan,
    vlan_reason: full.vlan_reason,
    remote_access_needed: full.remote_access_needed,
    remote_access_method: full.remote_access_method,
    vendor_public_ips: full.vendor_public_ips,
    has_own_router: full.has_own_router,
    vendor_signer_name: full.vendor_signer_name,
    vendor_signed_at: full.vendor_signed_at,
    interfaces: full.interfaces.map((r) => ({
      device_group: r.device_group,
      interface_type: r.interface_type,
      speed_mbps: r.speed_mbps,
      port_count: r.port_count,
      poe: r.poe,
      connection_place: r.connection_place,
      max_distance_m: r.max_distance_m,
      note: r.note,
    })),
    /** Jen požadavek na počet/způsob — bez konkrétních adres. */
    ips: full.ips.map((r) => ({
      device_service: r.device_service,
      allocation_mode: r.allocation_mode,
      ip_count: r.ip_count,
      note: r.note,
    })),
    firewall_rules: full.firewall_rules.map((r) => ({
      service_name: r.service_name,
      source_kind: r.source_kind,
      source_host: r.source_host,
      target_kind: r.target_kind,
      target_host: r.target_host,
      protocol: r.protocol,
      target_ports: r.target_ports,
      direction: r.direction,
      purpose: r.purpose,
      encrypted: r.encrypted,
      validity: r.validity,
      note: r.note,
    })),
    protocols: [],
    security_answers: full.security_answers,
    docs: full.docs.filter((d) => PUBLIC_DOC_KEYS.has(d.doc_key)),
    summary: full.summary,
  };
}

function mergeProtocols(rows: it_vendor_request_protocols[]) {
  const map = new Map(rows.map((r) => [r.protocol_key, r]));
  return PROTOCOL_CATALOG.map((p) => {
    const r = map.get(p.key);
    return {
      protocol_key: p.key,
      label: p.label,
      typical_ports: p.typicalPorts,
      used: r?.used ?? null,
      used_ports: r?.used_ports ?? null,
      note: r?.note ?? null,
    };
  });
}

function mergeSecurity(rows: it_vendor_request_security[]) {
  const map = new Map(rows.map((r) => [r.question_key, r]));
  return SECURITY_QUESTIONS.map((q) => {
    const r = map.get(q.key);
    return {
      question_key: q.key,
      label: q.label,
      answer: r?.answer ?? null,
      note: r?.note ?? null,
    };
  });
}

function mergeDocs(rows: it_vendor_request_docs[]) {
  const map = new Map(rows.map((r) => [r.doc_key, r]));
  return DOC_CATALOG.map((d) => {
    const r = map.get(d.key);
    return {
      doc_key: d.key,
      label: d.label,
      delivered: r?.delivered ?? null,
      file_ref: r?.file_ref ?? null,
    };
  });
}

export const detailInclude = {
  interfaces: { orderBy: { sort_order: "asc" as const } },
  ips: { orderBy: { sort_order: "asc" as const } },
  firewall_rules: { orderBy: { sort_order: "asc" as const } },
  contacts: { orderBy: { sort_order: "asc" as const } },
  protocols: true,
  security_answers: true,
  docs: true,
  users_created: {
    select: { id: true, first_name: true, last_name: true, email: true },
  },
  links: {
    orderBy: { created_at: "desc" as const },
    take: 10,
    select: {
      id: true,
      sent_to_email: true,
      expires_at: true,
      revoked_at: true,
      created_at: true,
    },
  },
} as const;

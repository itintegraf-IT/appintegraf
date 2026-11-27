export type Lookups = {
  interface_types: readonly string[];
  yes_no: readonly string[];
  yes_no_pending: readonly string[];
  allocation_modes: readonly string[];
  protocols: readonly string[];
  directions: readonly string[];
  source_target_kinds: readonly string[];
  validity_options: readonly string[];
  encryption_options: readonly string[];
  connection_types: readonly string[];
  dhcp_modes: readonly string[];
  remote_access_methods: readonly string[];
  network_placements: readonly string[];
  protocol_catalog: readonly { key: string; label: string; typicalPorts: string }[];
  security_questions: readonly { key: string; label: string }[];
  doc_catalog: readonly { key: string; label: string }[];
  contact_roles: readonly string[];
};

export type ContactRow = {
  role: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
};

/** Zařízení + požadavek na IP (bez konkrétních adres). */
export type DeviceRow = {
  device_group: string | null;
  interface_type: string | null;
  speed_mbps: number | null;
  port_count: number | null;
  poe: string | null;
  connection_place: string | null;
  max_distance_m: number | null;
  note: string | null;
  /** Požadavek na přidělení IP (dodavatel) */
  ip_count: number | null;
  allocation_mode: string | null;
  /** IT přidělení */
  assigned_ip_from?: string | null;
  assigned_ip_to?: string | null;
  assigned_note?: string | null;
};

export type FirewallRow = {
  service_name: string | null;
  source_kind: string | null;
  source_host: string | null;
  target_kind: string | null;
  target_host: string | null;
  protocol: string | null;
  target_ports: string | null;
  direction: string | null;
  purpose: string | null;
  encrypted: string | null;
  validity: string | null;
  note: string | null;
  implemented?: boolean;
  assigned_ip?: string | null;
  assigned_note?: string | null;
};

export type SecurityRow = {
  question_key: string;
  label?: string;
  answer: string | null;
  note: string | null;
};

export type DocRow = {
  doc_key: string;
  label?: string;
  delivered: string | null;
  file_ref: string | null;
};

export type FormState = {
  request_date: string | null;
  due_date: string | null;
  project_name: string | null;
  vendor_company: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contacts: ContactRow[];
  device_vendor_type: string | null;
  install_location: string | null;
  purpose: string | null;
  tech_description: string | null;
  requested_services: string | null;
  notes: string | null;
  /** Ano/Ne – vyžaduje oddělenou VLAN (ne číslo) */
  requested_vlan: string | null;
  vlan_reason: string | null;
  remote_access_needed: string | null;
  remote_access_method: string | null;
  vendor_public_ips: string | null;
  has_own_router: string | null;
  vendor_signer_name: string | null;
  /** Volné odkazy na dokumentaci */
  docs_links: string | null;
  devices: DeviceRow[];
  firewall_rules: FirewallRow[];
  security_answers: SecurityRow[];
  docs: DocRow[];
  // IT-only
  internal_notes?: string | null;
  assigned_vlan?: string | null;
  assigned_vlan_id?: number | null;
  it_network_notes?: string | null;
  pm_name?: string | null;
  it_name?: string | null;
  status?: string;
};

/** Vendor sekce (veřejný formulář). */
export const VENDOR_SECTIONS = [
  { id: "ident", label: "1. Identifikace" },
  { id: "devices", label: "2. Zařízení a IP" },
  { id: "fw", label: "3. Porty a firewall" },
  { id: "access", label: "4. Přístup a podpis" },
] as const;

/** Interní: vendor sekce + IT přidělení. */
export const INTERNAL_SECTIONS = [
  ...VENDOR_SECTIONS,
  { id: "it_net", label: "5. Přidělení sítě (IT)" },
] as const;

export function emptyContact(): ContactRow {
  return { role: null, name: null, phone: null, email: null };
}

export function emptyDevice(): DeviceRow {
  return {
    device_group: null,
    interface_type: null,
    speed_mbps: null,
    port_count: null,
    poe: null,
    connection_place: null,
    max_distance_m: null,
    note: null,
    ip_count: null,
    allocation_mode: null,
    assigned_ip_from: null,
    assigned_ip_to: null,
    assigned_note: null,
  };
}

export function emptyFw(): FirewallRow {
  return {
    service_name: null,
    source_kind: null,
    source_host: null,
    target_kind: null,
    target_host: null,
    protocol: null,
    target_ports: null,
    direction: null,
    purpose: null,
    encrypted: null,
    validity: null,
    note: null,
    implemented: false,
    assigned_ip: null,
    assigned_note: null,
  };
}

type ApiInterface = {
  device_group?: string | null;
  interface_type?: string | null;
  speed_mbps?: number | null;
  port_count?: number | null;
  poe?: string | null;
  connection_place?: string | null;
  max_distance_m?: number | null;
  note?: string | null;
};

type ApiIp = {
  device_service?: string | null;
  allocation_mode?: string | null;
  ip_count?: number | null;
  assigned_ip_from?: string | null;
  assigned_ip_to?: string | null;
  assigned_note?: string | null;
  note?: string | null;
};

function mergeDevices(
  interfaces: ApiInterface[] | undefined,
  ips: ApiIp[] | undefined
): DeviceRow[] {
  const ifaces = interfaces ?? [];
  const ipRows = ips ?? [];
  const len = Math.max(ifaces.length, ipRows.length, 1);
  const out: DeviceRow[] = [];
  for (let i = 0; i < len; i++) {
    const iface = ifaces[i];
    const ip = ipRows[i];
    if (!iface && !ip) {
      out.push(emptyDevice());
      continue;
    }
    out.push({
      device_group: iface?.device_group ?? ip?.device_service ?? null,
      interface_type: iface?.interface_type ?? null,
      speed_mbps: iface?.speed_mbps ?? null,
      port_count: iface?.port_count ?? null,
      poe: iface?.poe ?? null,
      connection_place: iface?.connection_place ?? null,
      max_distance_m: iface?.max_distance_m ?? null,
      note: iface?.note ?? ip?.note ?? null,
      ip_count: ip?.ip_count ?? null,
      allocation_mode: ip?.allocation_mode ?? null,
      assigned_ip_from: ip?.assigned_ip_from ?? null,
      assigned_ip_to: ip?.assigned_ip_to ?? null,
      assigned_note: ip?.assigned_note ?? null,
    });
  }
  return out.length ? out : [emptyDevice()];
}

/** Doc keys shown to vendor (trimmed). */
export const VENDOR_DOC_KEYS = ["network_schema", "technical_docs"] as const;

function loadContacts(item: Record<string, unknown>): ContactRow[] {
  const rows = (item.contacts as ContactRow[] | undefined) ?? [];
  if (rows.length) {
    return rows.map((c) => ({
      role: c.role ?? null,
      name: c.name ?? null,
      phone: c.phone ?? null,
      email: c.email ?? null,
    }));
  }
  if (item.contact_name || item.contact_phone || item.contact_email) {
    return [
      {
        role: null,
        name: (item.contact_name as string) ?? null,
        phone: (item.contact_phone as string) ?? null,
        email: (item.contact_email as string) ?? null,
      },
    ];
  }
  return [emptyContact()];
}

export function formFromItem(item: Record<string, unknown>): FormState {
  const allDocs = (item.docs as DocRow[]) ?? [];
  const docs = allDocs.filter((d) =>
    (VENDOR_DOC_KEYS as readonly string[]).includes(d.doc_key)
  );
  const docsLinks =
    allDocs
      .filter((d) => d.file_ref)
      .map((d) => d.file_ref)
      .filter(Boolean)
      .join("\n") || null;
  const contacts = loadContacts(item);
  const primary = contacts.find((c) => c.email) ?? contacts[0] ?? null;

  return {
    request_date: (item.request_date as string) ?? null,
    due_date: (item.due_date as string) ?? null,
    project_name: (item.project_name as string) ?? null,
    vendor_company: (item.vendor_company as string) ?? null,
    contact_name: primary?.name ?? null,
    contact_phone: primary?.phone ?? null,
    contact_email: primary?.email ?? null,
    contacts,
    device_vendor_type: (item.device_vendor_type as string) ?? null,
    install_location: (item.install_location as string) ?? null,
    purpose: (item.purpose as string) ?? null,
    tech_description: (item.tech_description as string) ?? null,
    requested_services: (item.requested_services as string) ?? null,
    notes: (item.notes as string) ?? null,
    requested_vlan: (item.requested_vlan as string) ?? null,
    vlan_reason: (item.vlan_reason as string) ?? null,
    remote_access_needed: (item.remote_access_needed as string) ?? null,
    remote_access_method: (item.remote_access_method as string) ?? null,
    vendor_public_ips: (item.vendor_public_ips as string) ?? null,
    has_own_router: (item.has_own_router as string) ?? null,
    vendor_signer_name: (item.vendor_signer_name as string) ?? null,
    docs_links: docsLinks,
    devices: mergeDevices(
      item.interfaces as ApiInterface[] | undefined,
      item.ips as ApiIp[] | undefined
    ),
    firewall_rules: ((item.firewall_rules as FirewallRow[]) ?? []).length
      ? (item.firewall_rules as FirewallRow[])
      : [emptyFw()],
    security_answers: (item.security_answers as SecurityRow[]) ?? [],
    docs: docs.length
      ? docs
      : VENDOR_DOC_KEYS.map((key) => ({
          doc_key: key,
          label: key === "network_schema" ? "Síťové schéma" : "Technická dokumentace",
          delivered: null,
          file_ref: null,
        })),
    internal_notes: (item.internal_notes as string) ?? null,
    assigned_vlan: (item.assigned_vlan as string) ?? null,
    assigned_vlan_id: (item.assigned_vlan_id as number | null) ?? null,
    it_network_notes: (item.it_network_notes as string) ?? null,
    pm_name: (item.pm_name as string) ?? null,
    it_name: (item.it_name as string) ?? null,
    status: item.status as string | undefined,
  };
}

/** FormState → API payload (interfaces + ips + legacy-compatible header). */
export function formToApiPayload(form: FormState, opts?: { includeIt?: boolean }) {
  const includeIt = opts?.includeIt ?? false;
  const devices = form.devices.filter(
    (d) =>
      d.device_group ||
      d.interface_type ||
      d.port_count != null ||
      d.ip_count != null ||
      d.allocation_mode ||
      d.note
  );
  const contacts = form.contacts.filter(
    (c) => c.role || c.name || c.phone || c.email
  );
  const primary = contacts.find((c) => c.email) ?? contacts[0] ?? null;

  const docsFromLinks = form.docs.map((d) => {
    if (d.doc_key === "technical_docs" && form.docs_links && !d.file_ref) {
      return { ...d, file_ref: form.docs_links };
    }
    return d;
  });

  return {
    request_date: form.request_date,
    due_date: form.due_date,
    project_name: form.project_name,
    vendor_company: form.vendor_company,
    contact_name: primary?.name ?? null,
    contact_phone: primary?.phone ?? null,
    contact_email: primary?.email ?? null,
    contacts,
    device_vendor_type: form.device_vendor_type,
    install_location: form.install_location,
    purpose: form.purpose,
    tech_description: form.tech_description,
    requested_services: form.requested_services,
    notes: form.notes,
    requested_vlan: form.requested_vlan,
    vlan_reason: form.vlan_reason,
    remote_access_needed: form.remote_access_needed,
    remote_access_method: form.remote_access_method,
    vendor_public_ips: form.vendor_public_ips,
    has_own_router: form.has_own_router,
    vendor_signer_name: form.vendor_signer_name,
    interfaces: devices.map((d) => ({
      device_group: d.device_group,
      interface_type: d.interface_type,
      speed_mbps: d.speed_mbps,
      port_count: d.port_count,
      poe: d.poe,
      requested_vlan: null,
      connection_place: d.connection_place,
      max_distance_m: d.max_distance_m,
      note: d.note,
    })),
    ips: devices.map((d) => ({
      device_service: d.device_group,
      allocation_mode: d.allocation_mode,
      ip_count: d.ip_count,
      ip_from: null,
      ip_to: null,
      mask_cidr: null,
      gateway: null,
      dns: null,
      mac_address: null,
      note: null,
      ...(includeIt
        ? {
            assigned_ip_from: d.assigned_ip_from ?? null,
            assigned_ip_to: d.assigned_ip_to ?? null,
            assigned_note: d.assigned_note ?? null,
          }
        : {}),
    })),
    firewall_rules: form.firewall_rules.map((r) => ({
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
      ...(includeIt
        ? {
            implemented: Boolean(r.implemented),
            assigned_ip: r.assigned_ip ?? null,
            assigned_note: r.assigned_note ?? null,
          }
        : {}),
    })),
    security_answers: form.security_answers,
    docs: docsFromLinks,
    protocols: [],
    ...(includeIt
      ? {
          internal_notes: form.internal_notes,
          assigned_vlan: form.assigned_vlan,
          assigned_vlan_id: form.assigned_vlan_id ?? null,
          it_network_notes: form.it_network_notes,
          pm_name: form.pm_name,
          it_name: form.it_name,
          status: form.status,
        }
      : {}),
  };
}

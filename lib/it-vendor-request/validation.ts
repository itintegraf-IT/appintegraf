import { z } from "zod";
import {
  DOC_CATALOG,
  PROTOCOL_CATALOG,
  SECURITY_QUESTIONS,
} from "@/lib/it-vendor-request/lookups";

const optionalString = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v == null) return null;
      const t = String(v).trim();
      return t ? t.slice(0, max) : null;
    });

const optionalInt = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  });

const optionalDate = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || v === "") return null;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d;
  });

const interfaceRowSchema = z.object({
  id: z.number().optional(),
  device_group: optionalString(255),
  interface_type: optionalString(150),
  speed_mbps: optionalInt,
  port_count: optionalInt,
  poe: optionalString(20),
  requested_vlan: optionalString(150),
  connection_place: optionalString(255),
  max_distance_m: optionalInt,
  note: optionalString(4000),
});

const ipRowSchema = z.object({
  id: z.number().optional(),
  device_service: optionalString(255),
  allocation_mode: optionalString(80),
  ip_count: optionalInt,
  ip_from: optionalString(100),
  ip_to: optionalString(100),
  mask_cidr: optionalString(50),
  gateway: optionalString(100),
  dns: optionalString(100),
  mac_address: optionalString(50),
  note: optionalString(4000),
  assigned_ip_from: optionalString(100).optional(),
  assigned_ip_to: optionalString(100).optional(),
  assigned_note: optionalString(4000).optional(),
});

const firewallRowSchema = z.object({
  id: z.number().optional(),
  service_name: optionalString(255),
  source_kind: optionalString(150),
  source_host: optionalString(255),
  target_kind: optionalString(150),
  target_host: optionalString(255),
  protocol: optionalString(50),
  target_ports: optionalString(100),
  direction: optionalString(80),
  purpose: optionalString(4000),
  encrypted: optionalString(50),
  validity: optionalString(80),
  note: optionalString(4000),
  implemented: z.boolean().optional(),
  assigned_ip: optionalString(100).optional(),
  assigned_note: optionalString(4000).optional(),
});

const protocolRowSchema = z.object({
  protocol_key: z.string().min(1).max(50),
  used: optionalString(20),
  used_ports: optionalString(100),
  note: optionalString(4000),
});

const securityRowSchema = z.object({
  question_key: z.string().min(1).max(50),
  answer: optionalString(50),
  note: optionalString(4000),
});

const docRowSchema = z.object({
  doc_key: z.string().min(1).max(50),
  delivered: optionalString(50),
  file_ref: optionalString(500),
});

const contactRowSchema = z.object({
  id: z.number().optional(),
  role: optionalString(100),
  name: optionalString(150),
  phone: optionalString(50),
  email: optionalString(190),
});

/** Vendor-editable fields (public form + IT can also edit). */
export const vendorFormSchema = z.object({
  request_date: optionalDate,
  due_date: optionalDate,
  project_name: optionalString(255),
  vendor_company: optionalString(255),
  contact_name: optionalString(150),
  contact_phone: optionalString(50),
  contact_email: optionalString(190),
  device_vendor_type: optionalString(255),
  install_location: optionalString(255),
  preferred_network_placement: optionalString(255),
  purpose: optionalString(8000),
  tech_description: optionalString(8000),
  requested_services: optionalString(8000),
  connection_type: optionalString(100),
  devices_needing_ip: optionalInt,
  dhcp_mode: optionalString(50),
  requested_ip_range: optionalString(255),
  notes: optionalString(8000),
  requested_vlan: optionalString(255),
  vlan_reason: optionalString(4000),
  remote_access_needed: optionalString(50),
  remote_access_method: optionalString(100),
  vendor_public_ips: optionalString(4000),
  has_own_router: optionalString(50),
  vendor_signer_name: optionalString(150),
  contacts: z.array(contactRowSchema).max(20).optional(),
  interfaces: z.array(interfaceRowSchema).max(40).optional(),
  ips: z.array(ipRowSchema).max(40).optional(),
  firewall_rules: z.array(firewallRowSchema).max(50).optional(),
  protocols: z.array(protocolRowSchema).max(20).optional(),
  security_answers: z.array(securityRowSchema).max(20).optional(),
  docs: z.array(docRowSchema).max(20).optional(),
});

/** IT-only patch fields */
export const itOnlySchema = z.object({
  status: z
    .enum([
      "draft",
      "sent",
      "submitted",
      "in_review",
      "approved",
      "rejected",
      "cancelled",
    ])
    .optional(),
  internal_notes: optionalString(8000),
  assigned_vlan: optionalString(255),
  assigned_vlan_id: z.number().int().positive().nullable().optional(),
  it_network_notes: optionalString(8000),
  rejection_reason: optionalString(4000),
  pm_name: optionalString(150),
  pm_signed_at: optionalDate,
  it_name: optionalString(150),
  it_signed_at: optionalDate,
});

export const internalPatchSchema = vendorFormSchema.merge(itOnlySchema).extend({
  ips: z
    .array(
      ipRowSchema.extend({
        assigned_ip_from: optionalString(100),
        assigned_ip_to: optionalString(100),
        assigned_note: optionalString(4000),
      })
    )
    .max(40)
    .optional(),
  firewall_rules: z
    .array(
      firewallRowSchema.extend({
        implemented: z.boolean().optional(),
        assigned_ip: optionalString(100),
        assigned_note: optionalString(4000),
      })
    )
    .max(50)
    .optional(),
});

export type VendorFormData = z.infer<typeof vendorFormSchema>;
export type InternalPatchData = z.infer<typeof internalPatchSchema>;

export function emptyProtocolRows() {
  return PROTOCOL_CATALOG.map((p) => ({
    protocol_key: p.key,
    used: null as string | null,
    used_ports: null as string | null,
    note: null as string | null,
  }));
}

export function emptySecurityRows() {
  return SECURITY_QUESTIONS.map((q) => ({
    question_key: q.key,
    answer: null as string | null,
    note: null as string | null,
  }));
}

export function emptyDocRows() {
  return DOC_CATALOG.map((d) => ({
    doc_key: d.key,
    delivered: null as string | null,
    file_ref: null as string | null,
  }));
}

export function isHoneypotTriggered(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const hp = (body as Record<string, unknown>).website;
  return typeof hp === "string" && hp.trim().length > 0;
}

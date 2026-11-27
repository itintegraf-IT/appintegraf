import { prisma, type PrismaTransactionClient } from "@/lib/db";
import type { VendorFormData, InternalPatchData } from "@/lib/it-vendor-request/validation";
import {
  emptyDocRows,
  emptyProtocolRows,
  emptySecurityRows,
} from "@/lib/it-vendor-request/validation";

type DbClient = typeof prisma | PrismaTransactionClient;

function syncPrimaryContact(data: VendorFormData) {
  const contacts = (data.contacts ?? []).filter(
    (c) => c.role || c.name || c.phone || c.email
  );
  const primary =
    contacts.find((c) => c.email) ?? contacts[0] ?? null;
  return {
    contact_name: primary?.name ?? data.contact_name ?? null,
    contact_phone: primary?.phone ?? data.contact_phone ?? null,
    contact_email: primary?.email ?? data.contact_email ?? null,
  };
}

function headerFromVendor(data: VendorFormData) {
  const primary = syncPrimaryContact(data);
  return {
    request_date: data.request_date,
    due_date: data.due_date,
    project_name: data.project_name,
    vendor_company: data.vendor_company,
    contact_name: primary.contact_name,
    contact_phone: primary.contact_phone,
    contact_email: primary.contact_email,
    device_vendor_type: data.device_vendor_type,
    install_location: data.install_location,
    preferred_network_placement: data.preferred_network_placement,
    purpose: data.purpose,
    tech_description: data.tech_description,
    requested_services: data.requested_services,
    connection_type: data.connection_type,
    devices_needing_ip: data.devices_needing_ip,
    dhcp_mode: data.dhcp_mode,
    requested_ip_range: data.requested_ip_range,
    notes: data.notes,
    requested_vlan: data.requested_vlan,
    vlan_reason: data.vlan_reason,
    remote_access_needed: data.remote_access_needed,
    remote_access_method: data.remote_access_method,
    vendor_public_ips: data.vendor_public_ips,
    has_own_router: data.has_own_router,
    vendor_signer_name: data.vendor_signer_name,
  };
}

function nonEmptyInterface(r: NonNullable<VendorFormData["interfaces"]>[number]) {
  return Boolean(
    r.device_group ||
      r.interface_type ||
      r.port_count != null ||
      r.connection_place ||
      r.note
  );
}

function nonEmptyIp(r: NonNullable<VendorFormData["ips"]>[number]) {
  return Boolean(
    r.device_service ||
      r.allocation_mode ||
      r.ip_count != null ||
      r.ip_from ||
      r.note
  );
}

function nonEmptyFw(r: NonNullable<VendorFormData["firewall_rules"]>[number]) {
  return Boolean(r.service_name || r.source_host || r.target_host || r.target_ports || r.purpose);
}

function nonEmptyContact(r: NonNullable<VendorFormData["contacts"]>[number]) {
  return Boolean(r.role || r.name || r.phone || r.email);
}

async function writeChildren(
  db: DbClient,
  requestId: number,
  data: VendorFormData | InternalPatchData,
  opts: { includeItAssigned: boolean; replace: boolean }
) {
  const interfaces = (data.interfaces ?? []).filter(nonEmptyInterface);
  const ips = (data.ips ?? []).filter(nonEmptyIp);
  const firewall = (data.firewall_rules ?? []).filter(nonEmptyFw);
  const contacts = (data.contacts ?? []).filter(nonEmptyContact);
  const protocols = data.protocols ?? emptyProtocolRows();
  const security = data.security_answers ?? emptySecurityRows();
  const docs = data.docs ?? emptyDocRows();

  if (opts.replace) {
    await Promise.all([
      db.it_vendor_request_interfaces.deleteMany({ where: { request_id: requestId } }),
      db.it_vendor_request_ips.deleteMany({ where: { request_id: requestId } }),
      db.it_vendor_request_firewall_rules.deleteMany({ where: { request_id: requestId } }),
      db.it_vendor_request_protocols.deleteMany({ where: { request_id: requestId } }),
      db.it_vendor_request_security.deleteMany({ where: { request_id: requestId } }),
      db.it_vendor_request_docs.deleteMany({ where: { request_id: requestId } }),
      db.it_vendor_request_contacts.deleteMany({ where: { request_id: requestId } }),
    ]);
  }

  if (contacts.length) {
    await db.it_vendor_request_contacts.createMany({
      data: contacts.map((r, i) => ({
        request_id: requestId,
        sort_order: i,
        role: r.role,
        name: r.name,
        phone: r.phone,
        email: r.email,
      })),
    });
  }

  if (interfaces.length) {
    await db.it_vendor_request_interfaces.createMany({
      data: interfaces.map((r, i) => ({
        request_id: requestId,
        sort_order: i,
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
    });
  }

  if (ips.length) {
    await db.it_vendor_request_ips.createMany({
      data: ips.map((r, i) => ({
        request_id: requestId,
        sort_order: i,
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
        assigned_ip_from: opts.includeItAssigned ? (r.assigned_ip_from ?? null) : null,
        assigned_ip_to: opts.includeItAssigned ? (r.assigned_ip_to ?? null) : null,
        assigned_note: opts.includeItAssigned ? (r.assigned_note ?? null) : null,
      })),
    });
  }

  if (firewall.length) {
    await db.it_vendor_request_firewall_rules.createMany({
      data: firewall.map((r, i) => ({
        request_id: requestId,
        sort_order: i,
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
        implemented: opts.includeItAssigned ? Boolean(r.implemented) : false,
        assigned_ip: opts.includeItAssigned ? (r.assigned_ip ?? null) : null,
        assigned_note: opts.includeItAssigned ? (r.assigned_note ?? null) : null,
      })),
    });
  }

  if (protocols.length) {
    await db.it_vendor_request_protocols.createMany({
      data: protocols.map((r) => ({
        request_id: requestId,
        protocol_key: r.protocol_key.slice(0, 50),
        used: r.used,
        used_ports: r.used_ports,
        note: r.note,
      })),
    });
  }

  if (security.length) {
    await db.it_vendor_request_security.createMany({
      data: security.map((r) => ({
        request_id: requestId,
        question_key: r.question_key.slice(0, 50),
        answer: r.answer,
        note: r.note,
      })),
    });
  }

  if (docs.length) {
    await db.it_vendor_request_docs.createMany({
      data: docs.map((r) => ({
        request_id: requestId,
        doc_key: r.doc_key.slice(0, 50),
        delivered: r.delivered,
        file_ref: r.file_ref,
      })),
    });
  }
}

async function replaceChildren(
  requestId: number,
  data: VendorFormData | InternalPatchData,
  opts: { includeItAssigned: boolean }
) {
  await writeChildren(prisma, requestId, data, {
    includeItAssigned: opts.includeItAssigned,
    replace: true,
  });
}

export async function createItVendorRequest(params: {
  createdBy: number;
  data?: Partial<VendorFormData>;
}) {
  const { generateItVendorRequestNumber } = await import(
    "@/lib/it-vendor-request/request-number"
  );
  const request_number = await generateItVendorRequestNumber();
  const parsed = params.data
    ? (await import("@/lib/it-vendor-request/validation")).vendorFormSchema.parse({
        ...params.data,
      })
    : null;

  const childData = parsed ?? {
    protocols: emptyProtocolRows(),
    security_answers: emptySecurityRows(),
    docs: emptyDocRows(),
  };

  return prisma.$transaction(async (tx) => {
    const row = await tx.it_vendor_requests.create({
      data: {
        request_number,
        status: "draft",
        created_by: params.createdBy,
        ...(parsed ? headerFromVendor(parsed) : {}),
        request_date: parsed?.request_date ?? new Date(),
      },
    });

    await writeChildren(tx, row.id, childData, {
      includeItAssigned: false,
      replace: false,
    });

    return row.id;
  });
}

/** Uložení vendor části (public) – nepřepisuje IT assigned pole. */
export async function saveVendorForm(requestId: number, data: VendorFormData) {
  const existing = await prisma.it_vendor_request_ips.findMany({
    where: { request_id: requestId },
    orderBy: { sort_order: "asc" },
  });
  const existingFw = await prisma.it_vendor_request_firewall_rules.findMany({
    where: { request_id: requestId },
    orderBy: { sort_order: "asc" },
  });

  // Zachovej IT assigned hodnoty podle pořadí (best-effort)
  const ipsWithAssigned = (data.ips ?? []).map((r, i) => ({
    ...r,
    assigned_ip_from: existing[i]?.assigned_ip_from ?? null,
    assigned_ip_to: existing[i]?.assigned_ip_to ?? null,
    assigned_note: existing[i]?.assigned_note ?? null,
  }));
  const fwWithAssigned = (data.firewall_rules ?? []).map((r, i) => ({
    ...r,
    implemented: existingFw[i]?.implemented ?? false,
    assigned_ip: existingFw[i]?.assigned_ip ?? null,
    assigned_note: existingFw[i]?.assigned_note ?? null,
  }));

  await prisma.it_vendor_requests.update({
    where: { id: requestId },
    data: {
      ...headerFromVendor(data),
      updated_at: new Date(),
    },
  });

  await replaceChildren(
    requestId,
    { ...data, ips: ipsWithAssigned, firewall_rules: fwWithAssigned },
    { includeItAssigned: true }
  );
}

/** Interní patch včetně IT polí. */
export async function saveInternalPatch(requestId: number, data: InternalPatchData) {
  const {
    assertAllocationAllowed,
    syncNetworkFromRequest,
  } = await import("@/lib/it-network/registry");

  const devices = (data.ips ?? []).map((r) => ({
    assigned_ip_from: r.assigned_ip_from,
    assigned_ip_to: r.assigned_ip_to,
  }));
  const firewall = (data.firewall_rules ?? []).map((r) => ({
    assigned_ip: r.assigned_ip,
    protocol: r.protocol,
    target_ports: r.target_ports,
    service_name: r.service_name,
    direction: r.direction,
    purpose: r.purpose,
  }));

  let vlanId =
    data.assigned_vlan_id !== undefined ? data.assigned_vlan_id : undefined;
  let assignedVlanLabel =
    data.assigned_vlan !== undefined ? data.assigned_vlan : undefined;

  if (vlanId != null) {
    const vlan = await prisma.it_network_vlans.findUnique({ where: { id: vlanId } });
    if (!vlan) throw new Error("Zvolená VLAN neexistuje");
    assignedVlanLabel = `VLAN ${vlan.vlan_number} – ${vlan.name}`;
  } else if (data.assigned_vlan_id === null) {
    vlanId = null;
  }

  await assertAllocationAllowed(
    requestId,
    devices,
    firewall,
    vlanId === undefined
      ? (
          await prisma.it_vendor_requests.findUnique({
            where: { id: requestId },
            select: { assigned_vlan_id: true },
          })
        )?.assigned_vlan_id
      : vlanId
  );

  const itFields: Record<string, unknown> = {};
  if (data.status !== undefined) itFields.status = data.status;
  if (data.internal_notes !== undefined) itFields.internal_notes = data.internal_notes;
  if (assignedVlanLabel !== undefined) itFields.assigned_vlan = assignedVlanLabel;
  if (vlanId !== undefined) itFields.assigned_vlan_id = vlanId;
  if (data.it_network_notes !== undefined) itFields.it_network_notes = data.it_network_notes;
  if (data.rejection_reason !== undefined) itFields.rejection_reason = data.rejection_reason;
  if (data.pm_name !== undefined) itFields.pm_name = data.pm_name;
  if (data.pm_signed_at !== undefined) itFields.pm_signed_at = data.pm_signed_at;
  if (data.it_name !== undefined) itFields.it_name = data.it_name;
  if (data.it_signed_at !== undefined) itFields.it_signed_at = data.it_signed_at;

  await prisma.it_vendor_requests.update({
    where: { id: requestId },
    data: {
      ...headerFromVendor(data),
      ...itFields,
      updated_at: new Date(),
    },
  });

  await replaceChildren(requestId, data, { includeItAssigned: true });
  await syncNetworkFromRequest(requestId);
}

export async function submitVendorForm(requestId: number, data: VendorFormData) {
  await saveVendorForm(requestId, data);
  const now = new Date();
  await prisma.it_vendor_requests.update({
    where: { id: requestId },
    data: {
      status: "submitted",
      submitted_at: now,
      vendor_signed_at: data.vendor_signer_name ? now : null,
      updated_at: now,
    },
  });
}

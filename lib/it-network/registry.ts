import { prisma } from "@/lib/db";
import { expandCidrHosts, expandIpRange, sortIpStrings } from "@/lib/it-network/ipv4";

export class NetworkAllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkAllocationError";
  }
}

export async function createVlan(input: {
  vlan_number: number;
  name: string;
  description?: string | null;
}) {
  return prisma.it_network_vlans.create({
    data: {
      vlan_number: input.vlan_number,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      active: true,
    },
  });
}

export async function createSubnetWithIps(input: {
  vlan_id: number;
  cidr: string;
  gateway?: string | null;
  note?: string | null;
}) {
  const hosts = expandCidrHosts(input.cidr);
  const existing = await prisma.it_network_ips.findMany({
    where: { ip_address: { in: hosts } },
    select: { ip_address: true },
  });
  if (existing.length) {
    throw new NetworkAllocationError(
      `IP už existují v registru: ${existing
        .slice(0, 5)
        .map((r) => r.ip_address)
        .join(", ")}${existing.length > 5 ? "…" : ""}`
    );
  }

  return prisma.$transaction(async (tx) => {
    const subnet = await tx.it_network_subnets.create({
      data: {
        vlan_id: input.vlan_id,
        cidr: input.cidr.trim(),
        gateway: input.gateway?.trim() || null,
        note: input.note?.trim() || null,
      },
    });
    // createMany v dávkách
    const chunk = 200;
    for (let i = 0; i < hosts.length; i += chunk) {
      const slice = hosts.slice(i, i + chunk);
      await tx.it_network_ips.createMany({
        data: slice.map((ip_address) => ({
          subnet_id: subnet.id,
          ip_address,
          status: "free" as const,
        })),
      });
    }
    return subnet;
  });
}

type FwPort = {
  assigned_ip?: string | null;
  protocol?: string | null;
  target_ports?: string | null;
  service_name?: string | null;
  direction?: string | null;
  purpose?: string | null;
};

type DeviceRange = {
  assigned_ip_from?: string | null;
  assigned_ip_to?: string | null;
};

/** Sběr IP z rozsahů zařízení + firewall assigned_ip. */
export function collectIpsFromAssignment(
  devices: DeviceRange[],
  firewall: FwPort[]
): { rangeIps: string[]; firewallIps: string[]; all: string[] } {
  const rangeSet = new Set<string>();
  for (const d of devices) {
    const from = (d.assigned_ip_from ?? "").trim();
    const to = (d.assigned_ip_to ?? "").trim();
    if (!from && !to) continue;
    for (const ip of expandIpRange(from || to, to || from)) rangeSet.add(ip);
  }
  const fwSet = new Set<string>();
  for (const r of firewall) {
    const ip = (r.assigned_ip ?? "").trim();
    if (ip) fwSet.add(ip);
  }
  const all = sortIpStrings([...new Set([...rangeSet, ...fwSet])]);
  return { rangeIps: sortIpStrings([...rangeSet]), firewallIps: sortIpStrings([...fwSet]), all };
}

/**
 * Ověří, že IP jsou v registru a nejsou přidělené jinému požadavku.
 * Firewall IP musí být v rozsahu zařízení (pokud je rozsah vyplněn).
 */
export async function assertAllocationAllowed(
  requestId: number,
  devices: DeviceRange[],
  firewall: FwPort[],
  vlanId: number | null | undefined
): Promise<void> {
  const { rangeIps, firewallIps, all } = collectIpsFromAssignment(devices, firewall);
  if (all.length === 0) return;

  if (rangeIps.length && firewallIps.length) {
    const rangeSet = new Set(rangeIps);
    const outside = firewallIps.filter((ip) => !rangeSet.has(ip));
    if (outside.length) {
      throw new NetworkAllocationError(
        `Firewall IP mimo přidělený rozsah: ${outside.join(", ")}`
      );
    }
  }

  const rows = await prisma.it_network_ips.findMany({
    where: { ip_address: { in: all } },
    include: {
      subnet: { include: { vlan: true } },
      request: { select: { id: true, request_number: true, vendor_company: true } },
    },
  });
  const byIp = new Map(rows.map((r) => [r.ip_address, r]));

  const missing = all.filter((ip) => !byIp.has(ip));
  if (missing.length) {
    throw new NetworkAllocationError(
      `IP nejsou v registru (nejprve založte VLAN/subnet): ${missing.join(", ")}`
    );
  }

  for (const ip of all) {
    const row = byIp.get(ip)!;
    if (vlanId && row.subnet.vlan_id !== vlanId) {
      throw new NetworkAllocationError(
        `IP ${ip} nepatří do zvolené VLAN (je ve VLAN ${row.subnet.vlan.vlan_number}).`
      );
    }
    if (row.status === "allocated" && row.request_id !== requestId) {
      const who = row.request_id
        ? row.request?.request_number ||
          row.request?.vendor_company ||
          `požadavek #${row.request_id}`
        : [row.device_kind, row.label].filter(Boolean).join(" – ") || "ruční přidělení";
      throw new NetworkAllocationError(`IP ${ip} je už přidělena: ${who}`);
    }
  }
}

/** Po uložení požadavku: označí IP, synchronizuje porty, uvolní nepoužité. */
export async function syncNetworkFromRequest(requestId: number): Promise<void> {
  const row = await prisma.it_vendor_requests.findUnique({
    where: { id: requestId },
    include: {
      ips: { orderBy: { sort_order: "asc" } },
      firewall_rules: { orderBy: { sort_order: "asc" } },
    },
  });
  if (!row) return;

  const devices = row.ips.map((r) => ({
    assigned_ip_from: r.assigned_ip_from,
    assigned_ip_to: r.assigned_ip_to,
  }));
  const firewall = row.firewall_rules.map((r) => ({
    assigned_ip: r.assigned_ip,
    protocol: r.protocol,
    target_ports: r.target_ports,
    service_name: r.service_name,
    direction: r.direction,
    purpose: r.purpose,
  }));

  const { all, firewallIps } = collectIpsFromAssignment(devices, firewall);

  await assertAllocationAllowed(requestId, devices, firewall, row.assigned_vlan_id);

  await prisma.$transaction(async (tx) => {
    // Uvolni IP dříve přidělené tomuto požadavku, které už nejsou v sadě
    const previously = await tx.it_network_ips.findMany({
      where: { request_id: requestId },
    });
    const keep = new Set(all);
    const toRelease = previously.filter((r) => !keep.has(r.ip_address));
    if (toRelease.length) {
      await tx.it_network_ip_ports.deleteMany({
        where: {
          request_id: requestId,
          ip_id: { in: toRelease.map((r) => r.id) },
        },
      });
      await tx.it_network_ips.updateMany({
        where: { id: { in: toRelease.map((r) => r.id) } },
        data: {
          status: "free",
          request_id: null,
          allocated_at: null,
          note: null,
          device_kind: null,
          label: null,
          description: null,
        },
      });
    }

    if (all.length) {
      const now = new Date();
      await tx.it_network_ips.updateMany({
        where: { ip_address: { in: all } },
        data: {
          status: "allocated",
          request_id: requestId,
          allocated_at: now,
        },
      });
    }

    // Porty: smaž staré z tohoto požadavku a zapiš z firewallu
    await tx.it_network_ip_ports.deleteMany({ where: { request_id: requestId } });

    if (firewallIps.length) {
      const ipRows = await tx.it_network_ips.findMany({
        where: { ip_address: { in: firewallIps } },
      });
      const idByIp = new Map(ipRows.map((r) => [r.ip_address, r.id]));
      const portData = firewall
        .filter((r) => (r.assigned_ip ?? "").trim())
        .map((r) => {
          const ip = (r.assigned_ip ?? "").trim();
          const ipId = idByIp.get(ip);
          if (!ipId) return null;
          return {
            ip_id: ipId,
            request_id: requestId,
            protocol: r.protocol ?? null,
            port: r.target_ports ?? null,
            service_name: r.service_name ?? null,
            direction: r.direction ?? null,
            purpose: r.purpose ?? null,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null);
      if (portData.length) {
        await tx.it_network_ip_ports.createMany({ data: portData });
      }
    }
  });
}

export async function releaseNetworkForRequest(requestId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.it_network_ip_ports.deleteMany({ where: { request_id: requestId } });
    await tx.it_network_ips.updateMany({
      where: { request_id: requestId },
      data: {
        status: "free",
        request_id: null,
        allocated_at: null,
        note: null,
        device_kind: null,
        label: null,
        description: null,
      },
    });
  });
}

export const NETWORK_DEVICE_KINDS = [
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

/** Ruční přidělení / úprava / uvolnění IP (bez vendor požadavku). */
export async function assignIpManually(
  ipId: number,
  input: {
    device_kind?: string | null;
    label?: string | null;
    description?: string | null;
    release?: boolean;
  }
) {
  const row = await prisma.it_network_ips.findUnique({ where: { id: ipId } });
  if (!row) throw new NetworkAllocationError("IP nenalezena");

  if (input.release) {
    if (row.request_id) {
      throw new NetworkAllocationError(
        "IP je vázaná na požadavek dodavatele – uvolněte ji úpravou / smazáním požadavku."
      );
    }
    return prisma.it_network_ips.update({
      where: { id: ipId },
      data: {
        status: "free",
        device_kind: null,
        label: null,
        description: null,
        note: null,
        allocated_at: null,
      },
    });
  }

  if (row.request_id) {
    // Jen doplnění popisu u IP z požadavku
    return prisma.it_network_ips.update({
      where: { id: ipId },
      data: {
        device_kind: input.device_kind?.trim() || null,
        label: input.label?.trim() || null,
        description: input.description?.trim() || null,
      },
    });
  }

  const kind = input.device_kind?.trim() || null;
  const label = input.label?.trim() || null;
  if (!kind && !label) {
    throw new NetworkAllocationError("Zadejte typ zařízení nebo název");
  }

  return prisma.it_network_ips.update({
    where: { id: ipId },
    data: {
      status: "allocated",
      device_kind: kind,
      label,
      description: input.description?.trim() || null,
      allocated_at: row.allocated_at ?? new Date(),
    },
  });
}

export async function listVlansWithStats() {
  const vlans = await prisma.it_network_vlans.findMany({
    orderBy: { vlan_number: "asc" },
    include: {
      subnets: {
        orderBy: { cidr: "asc" },
        include: {
          _count: {
            select: { ips: true },
          },
          ips: {
            select: { status: true },
          },
        },
      },
    },
  });

  return vlans.map((v) => ({
    id: v.id,
    vlan_number: v.vlan_number,
    name: v.name,
    description: v.description,
    active: v.active,
    subnets: v.subnets.map((s) => {
      const free = s.ips.filter((i) => i.status === "free").length;
      const allocated = s.ips.filter((i) => i.status === "allocated").length;
      return {
        id: s.id,
        cidr: s.cidr,
        gateway: s.gateway,
        note: s.note,
        total: s._count.ips,
        free,
        allocated,
      };
    }),
  }));
}

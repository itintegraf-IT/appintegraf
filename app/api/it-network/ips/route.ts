import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseIpv4 } from "@/lib/it-network/ipv4";
import { canManageItVendorRequests } from "@/lib/it-vendor-request/access";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageItVendorRequests(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const vlanId = sp.get("vlan_id") ? parseInt(sp.get("vlan_id")!, 10) : null;
  const subnetId = sp.get("subnet_id") ? parseInt(sp.get("subnet_id")!, 10) : null;
  const status = sp.get("status"); // free | allocated | all
  const requestId = sp.get("request_id") ? parseInt(sp.get("request_id")!, 10) : null;
  const q = (sp.get("q") ?? "").trim();
  const availableFor = sp.get("available_for")
    ? parseInt(sp.get("available_for")!, 10)
    : null;

  const where: Prisma.it_network_ipsWhereInput = {};
  if (subnetId && Number.isFinite(subnetId)) where.subnet_id = subnetId;
  if (vlanId && Number.isFinite(vlanId)) where.subnet = { vlan_id: vlanId };
  if (status === "free" || status === "allocated") where.status = status;
  if (requestId && Number.isFinite(requestId)) where.request_id = requestId;
  if (availableFor && Number.isFinite(availableFor)) {
    where.OR = [{ status: "free" }, { request_id: availableFor }];
  }
  if (q) where.ip_address = { contains: q };

  const rows = await prisma.it_network_ips.findMany({
    where,
    take: 2000,
    include: {
      subnet: {
        include: { vlan: { select: { id: true, vlan_number: true, name: true } } },
      },
      request: {
        select: {
          id: true,
          request_number: true,
          vendor_company: true,
          project_name: true,
        },
      },
      ports: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          protocol: true,
          port: true,
          service_name: true,
          direction: true,
          purpose: true,
        },
      },
    },
  });

  // Číselné řazení IP (1,2,3… ne lexikograficky 1,10,11…)
  rows.sort((a, b) => (parseIpv4(a.ip_address) ?? 0) - (parseIpv4(b.ip_address) ?? 0));

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      ip_address: r.ip_address,
      status: r.status,
      device_kind: r.device_kind,
      label: r.label,
      description: r.description,
      note: r.note,
      allocated_at: r.allocated_at?.toISOString() ?? null,
      subnet: {
        id: r.subnet.id,
        cidr: r.subnet.cidr,
        vlan: r.subnet.vlan,
      },
      request: r.request,
      ports: r.ports,
    })),
  });
}

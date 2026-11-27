import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageItVendorRequests } from "@/lib/it-vendor-request/access";
import { saveInternalPatch } from "@/lib/it-vendor-request/persist";
import { detailInclude, serializeInternal } from "@/lib/it-vendor-request/serialize";
import { internalPatchSchema } from "@/lib/it-vendor-request/validation";
import {
  ALLOCATION_MODES,
  CONNECTION_TYPES,
  CONTACT_ROLES,
  DHCP_MODES,
  DIRECTIONS,
  DOC_CATALOG,
  ENCRYPTION_OPTIONS,
  INTERFACE_TYPES,
  IT_VENDOR_STATUS_LABELS,
  NETWORK_PLACEMENTS,
  PROTOCOL_CATALOG,
  PROTOCOLS,
  REMOTE_ACCESS_METHODS,
  SECURITY_QUESTIONS,
  SOURCE_TARGET_KINDS,
  VALIDITY_OPTIONS,
  YES_NO,
  YES_NO_PENDING,
} from "@/lib/it-vendor-request/lookups";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageItVendorRequests(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await ctx.params).id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const row = await prisma.it_vendor_requests.findUnique({
    where: { id },
    include: detailInclude,
  });
  if (!row) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  return NextResponse.json({
    item: serializeInternal(row),
    status_labels: IT_VENDOR_STATUS_LABELS,
    lookups: {
      interface_types: INTERFACE_TYPES,
      yes_no: YES_NO,
      yes_no_pending: YES_NO_PENDING,
      allocation_modes: ALLOCATION_MODES,
      protocols: PROTOCOLS,
      directions: DIRECTIONS,
      source_target_kinds: SOURCE_TARGET_KINDS,
      validity_options: VALIDITY_OPTIONS,
      encryption_options: ENCRYPTION_OPTIONS,
      connection_types: CONNECTION_TYPES,
      dhcp_modes: DHCP_MODES,
      remote_access_methods: REMOTE_ACCESS_METHODS,
      network_placements: NETWORK_PLACEMENTS,
      protocol_catalog: PROTOCOL_CATALOG,
      security_questions: SECURITY_QUESTIONS,
      doc_catalog: DOC_CATALOG,
      contact_roles: CONTACT_ROLES,
    },
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageItVendorRequests(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await ctx.params).id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.it_vendor_requests.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = internalPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Neplatná data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await saveInternalPatch(id, parsed.data);
    const row = await prisma.it_vendor_requests.findUnique({
      where: { id },
      include: detailInclude,
    });
    return NextResponse.json({ success: true, item: row ? serializeInternal(row) : null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba při ukládání";
    if (e instanceof Error && e.name === "NetworkAllocationError") {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error("it-vendor-requests PATCH:", e);
    return NextResponse.json({ error: msg || "Chyba při ukládání" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageItVendorRequests(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await ctx.params).id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.it_vendor_requests.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  try {
    const { releaseNetworkForRequest } = await import("@/lib/it-network/registry");
    await releaseNetworkForRequest(id);
    await prisma.it_vendor_requests.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: true });
  } catch (e) {
    console.error("it-vendor-requests DELETE:", e);
    return NextResponse.json({ error: "Chyba při mazání" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageItVendorRequests } from "@/lib/it-vendor-request/access";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  it_name: z.string().trim().min(1).max(150),
  assigned_it_user_id: z.number().int().positive().optional().nullable(),
  pm_name: z.string().trim().max(150).optional().nullable(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
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

  const row = await prisma.it_vendor_requests.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }
  if (!["submitted", "in_review"].includes(row.status)) {
    return NextResponse.json(
      { error: "Schválit lze jen odeslaný / rozpracovaný požadavek" },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vyplňte jméno IT schvalovatele" }, { status: 400 });
  }

  let itName = parsed.data.it_name;
  let assignedItUserId = parsed.data.assigned_it_user_id ?? null;

  if (assignedItUserId) {
    const u = await prisma.users.findUnique({
      where: { id: assignedItUserId },
      select: { id: true, first_name: true, last_name: true },
    });
    if (!u) {
      return NextResponse.json({ error: "Vybraný IT uživatel neexistuje" }, { status: 400 });
    }
    itName = `${u.first_name} ${u.last_name}`.trim() || itName;
  }

  const now = new Date();
  await prisma.it_vendor_requests.update({
    where: { id },
    data: {
      status: "approved",
      it_name: itName,
      assigned_it_user_id: assignedItUserId,
      it_signed_at: now,
      pm_name: parsed.data.pm_name?.trim() || row.pm_name,
      pm_signed_at: parsed.data.pm_name?.trim() ? now : row.pm_signed_at,
      approved_at: now,
      updated_at: now,
    },
  });

  return NextResponse.json({ success: true });
}

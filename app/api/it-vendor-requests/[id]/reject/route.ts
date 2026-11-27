import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageItVendorRequests } from "@/lib/it-vendor-request/access";
import { revokeOpenItVendorLinks } from "@/lib/it-vendor-request/tokens";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  reason: z.string().trim().min(1).max(4000),
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
  if (["approved", "cancelled"].includes(row.status)) {
    return NextResponse.json({ error: "Nelze zamítnout" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Uveďte důvod zamítnutí" }, { status: 400 });
  }

  await revokeOpenItVendorLinks(id);
  await prisma.it_vendor_requests.update({
    where: { id },
    data: {
      status: "rejected",
      rejection_reason: parsed.data.reason,
      updated_at: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}

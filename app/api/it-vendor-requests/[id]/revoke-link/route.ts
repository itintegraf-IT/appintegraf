import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageItVendorRequests } from "@/lib/it-vendor-request/access";
import { revokeOpenItVendorLinks } from "@/lib/it-vendor-request/tokens";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
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

  await revokeOpenItVendorLinks(id);
  return NextResponse.json({ success: true });
}

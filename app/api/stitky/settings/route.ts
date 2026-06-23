import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerStitky } from "@/lib/stitky/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const rows = await prisma.stitky_settings.findMany();
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = await req.json();
  if (body.email_recipients != null) {
    const value = String(body.email_recipients).trim();
    await prisma.stitky_settings.upsert({
      where: { key: "email_recipients" },
      create: { key: "email_recipients", value },
      update: { value },
    });
  }

  return NextResponse.json({ ok: true });
}

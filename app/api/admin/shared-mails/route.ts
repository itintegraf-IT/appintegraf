import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const list = await prisma.shared_mails.findMany({
    orderBy: [{ sort_order: "asc" }, { label: "asc" }],
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const adminId = parseInt(session.user.id, 10);
  if (!(await isAdmin(adminId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { email?: string; label?: string; sort_order?: number; is_active?: boolean };
    const email = String(body.email ?? "").trim().toLowerCase();
    const label = String(body.label ?? "").trim();
    if (!email || !label) {
      return NextResponse.json({ error: "Vyplňte e-mail a popisek" }, { status: 400 });
    }

    const row = await prisma.shared_mails.create({
      data: {
        email,
        label,
        sort_order: body.sort_order ?? 0,
        is_active: body.is_active !== false,
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    console.error("POST shared_mails", e);
    return NextResponse.json(
      { error: "E-mail již existuje nebo se nepodařilo uložit" },
      { status: 400 }
    );
  }
}

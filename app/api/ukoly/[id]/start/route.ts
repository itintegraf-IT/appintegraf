import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { userCanCompleteUkol } from "@/lib/ukoly-access";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "ukoly", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanCompleteUkol(userId, id))) {
    return NextResponse.json({ error: "Nemáte oprávnění potvrdit rozpracování" }, { status: 403 });
  }

  const ukol = await prisma.ukoly.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!ukol) {
    return NextResponse.json({ error: "Úkol nenalezen" }, { status: 404 });
  }
  if (ukol.status === "done" || ukol.status === "cancelled") {
    return NextResponse.json({ error: "Archivovaný úkol nelze rozpracovat" }, { status: 400 });
  }
  if (ukol.status === "in_progress") {
    return NextResponse.json({ success: true, alreadyStarted: true });
  }

  await prisma.ukoly.update({
    where: { id },
    data: { status: "in_progress" },
  });

  return NextResponse.json({ success: true });
}

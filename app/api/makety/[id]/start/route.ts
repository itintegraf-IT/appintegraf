import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { userCanCompleteMaketa } from "@/lib/makety-access";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanCompleteMaketa(userId, id))) {
    return NextResponse.json({ error: "Nemáte oprávnění zahájit výrobu" }, { status: 403 });
  }

  const maketa = await prisma.makety.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!maketa) {
    return NextResponse.json({ error: "Maketa nenalezena" }, { status: 404 });
  }
  if (maketa.status === "done" || maketa.status === "cancelled") {
    return NextResponse.json({ error: "Archivovanou maketu nelze rozpracovat" }, { status: 400 });
  }
  if (maketa.status === "in_progress") {
    return NextResponse.json({ success: true, alreadyStarted: true });
  }
  if (maketa.status !== "open") {
    return NextResponse.json(
      { error: "Výrobu lze zahájit až po schválení nabídky zadavatelem" },
      { status: 400 }
    );
  }

  await prisma.makety.update({
    where: { id },
    data: { status: "in_progress" },
  });

  return NextResponse.json({ success: true });
}

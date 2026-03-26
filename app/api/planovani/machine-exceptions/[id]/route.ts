import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPlanovaniRole } from "@/lib/planovani-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));
  if (!["ADMIN", "PLANOVAT"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const exceptionId = parseInt(id, 10);
  if (isNaN(exceptionId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.planovani_machine_schedule_exceptions.findUnique({
    where: { id: exceptionId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Výjimka nenalezena" }, { status: 404 });
  }

  await prisma.planovani_machine_schedule_exceptions.delete({ where: { id: exceptionId } });

  return NextResponse.json({ ok: true });
}

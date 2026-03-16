import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** PATCH – označit notifikaci jako přečtenou */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const userId = parseInt(session.user.id, 10);

  const updated = await prisma.notifications.updateMany({
    where: { id, user_id: userId },
    data: { read_at: new Date() },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Notifikace nenalezena" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { userCanViewMaketa } from "@/lib/makety-access";
import { maketyFileEventLabel } from "@/lib/makety-file-events";

export async function GET(
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

  const maketaId = parseInt((await params).id, 10);
  if (Number.isNaN(maketaId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanViewMaketa(userId, maketaId))) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  const rows = await prisma.makety_file_events.findMany({
    where: { maketa_id: maketaId },
    orderBy: { created_at: "desc" },
    take: 200,
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({
    events: rows.map((r) => ({
      id: r.id,
      event_type: r.event_type,
      event_label: maketyFileEventLabel(r.event_type),
      file_id: r.file_id,
      meta: r.meta,
      created_at: r.created_at,
      user: r.users
        ? `${r.users.first_name} ${r.users.last_name}`
        : r.event_type === "softproof_downloaded"
          ? "Klient (veřejný odkaz)"
          : null,
    })),
  });
}

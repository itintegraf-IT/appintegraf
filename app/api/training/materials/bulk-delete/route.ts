import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

/** Hromadné smazání výukových materiálů. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat materiály" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const ids = Array.isArray(body.ids)
      ? ([
          ...new Set(
            body.ids
              .map((id: unknown) => parseInt(String(id), 10))
              .filter((id: number) => !isNaN(id))
          ),
        ] as number[])
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Nebyly vybrány žádné materiály" }, { status: 400 });
    }

    const result = await prisma.learning_materials.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({ success: true, deleted: result.count });
  } catch (e) {
    console.error("Training materials bulk-delete error:", e);
    return NextResponse.json({ error: "Chyba při hromadném mazání materiálů" }, { status: 500 });
  }
}

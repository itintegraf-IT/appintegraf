import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { prisma } from "@/lib/projekty/prisma";
import { AppError } from "@/lib/projekty/errors";
import { CardSearchSchema } from "@/lib/projekty/validators/card-search";
import { buildCardSearchWhere } from "@/lib/projekty/card-search";

// GET /api/projekty/cards?q= — hledání karet pro command palette.
// Prisma contains (bez fulltext indexu — take 20 to limituje; fulltext
// přijde s MySQL konfigurací od Michala).
export const GET = withApiError(async (req: NextRequest) => {
  const user = await requireSession();
  const parsed = CardSearchSchema.safeParse({
    q: new URL(req.url).searchParams.get("q") ?? "",
  });
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.message);

  const cards = await prisma.card.findMany({
    where: buildCardSearchWhere(user, parsed.data.q),
    take: 20,
    orderBy: { updatedAt: "desc" },
    select: { id: true, number: true, title: true, boardId: true, completed: true },
  });

  return NextResponse.json({ cards });
});

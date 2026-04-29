import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const MIN_LEN = 2;
const LIMIT = 12;

/**
 * Rychlé návrhy pro vyhledávání: jméno, příjmení, e-mail (stejné filtry jako seznam kontaktů).
 * Čtení: všichni přihlášení (jako GET /api/contacts).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < MIN_LEN) {
    return NextResponse.json({ suggestions: [] });
  }

  const andConditions: Record<string, unknown>[] = [
    { OR: [{ is_active: true }, { is_active: null }] },
    { OR: [{ display_in_list: true }, { display_in_list: null }] },
    {
      OR: [
        { first_name: { contains: q } },
        { last_name: { contains: q } },
        { email: { contains: q } },
        {
          user_shared_mails: {
            some: {
              shared_mails: {
                AND: [
                  { OR: [{ is_active: true }, { is_active: null }] },
                  {
                    OR: [{ email: { contains: q } }, { label: { contains: q } }],
                  },
                ],
              },
            },
          },
        },
      ],
    },
  ];

  const rows = await prisma.users.findMany({
    where: { AND: andConditions },
    take: LIMIT,
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
    },
  });

  return NextResponse.json({ suggestions: rows });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

async function requireWrite(): Promise<{ userId: number } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat skupiny" }, { status: 403 });
  }
  return { userId };
}

/** Seznam skupin s členy + seznam aktivních uživatelů pro výběr. */
export async function GET() {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;

  const [groups, users] = await Promise.all([
    prisma.user_groups.findMany({
      include: {
        user_group_members: {
          include: {
            users_user_group_members_user_idTousers: {
              select: { id: true, first_name: true, last_name: true, is_active: true },
            },
          },
        },
        _count: { select: { test_assignments: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.users.findMany({
      where: { is_active: true },
      select: { id: true, first_name: true, last_name: true, department_name: true },
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    }),
  ]);

  return NextResponse.json({ groups, users });
}

export async function POST(req: NextRequest) {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;
  const { userId } = access;

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Vyplňte název skupiny" }, { status: 400 });
    }

    const group = await prisma.user_groups.create({
      data: {
        name,
        description: String(body.description ?? "").trim() || null,
        created_by: userId,
      },
    });

    if (Array.isArray(body.member_ids)) {
      const memberIds = body.member_ids
        .map((id: unknown) => parseInt(String(id), 10))
        .filter((id: number) => !isNaN(id));
      if (memberIds.length > 0) {
        await prisma.user_group_members.createMany({
          data: memberIds.map((memberId: number) => ({
            group_id: group.id,
            user_id: memberId,
            added_by: userId,
          })),
        });
      }
    }

    return NextResponse.json({ success: true, id: group.id });
  } catch (e) {
    console.error("Training group POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření skupiny" }, { status: 500 });
  }
}

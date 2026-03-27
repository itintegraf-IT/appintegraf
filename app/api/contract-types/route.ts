import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** GET /api/contract-types – aktivní typy smluv (pro formuláře). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const types = await prisma.contract_types.findMany({
    where: { is_active: true },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    include: {
      contract_workflow_steps: {
        orderBy: { step_order: "asc" },
        select: {
          id: true,
          step_order: true,
          resolver: true,
          fixed_user_id: true,
        },
      },
    },
  });

  return NextResponse.json({ contract_types: types });
}

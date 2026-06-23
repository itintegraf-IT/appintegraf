import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageHelpdesk } from "@/lib/helpdesk/access";
import { getDepartmentMembers } from "@/lib/equipment-departments";

/** GET – kontext pro helpdesk UI */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const [canManage, itMembers] = await Promise.all([
    canManageHelpdesk(userId),
    getDepartmentMembers("IT"),
  ]);

  return NextResponse.json({
    userId,
    canManageHelpdesk: canManage,
    itMembers,
  });
}

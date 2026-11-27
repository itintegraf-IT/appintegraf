import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageItVendorRequests } from "@/lib/it-vendor-request/access";
import { getDepartmentMembers } from "@/lib/equipment-departments";

/** Seznam uživatelů oddělení IT pro výběr zpracovatele / schvalovatele. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageItVendorRequests(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const members = await getDepartmentMembers("IT");
  return NextResponse.json({
    current_user_id: userId,
    items: members.map((u) => ({
      id: u.id,
      name: `${u.first_name} ${u.last_name}`.trim(),
      email: u.email,
    })),
  });
}

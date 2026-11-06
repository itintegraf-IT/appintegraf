import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logPersonalistikaAudit } from "@/lib/personalistika-audit";
import { syncEmployeesFromActiveUsers } from "@/lib/personalistika-employees";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "personalistika", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění." }, { status: 403 });
  }

  try {
    const result = await syncEmployeesFromActiveUsers(userId);
    await logPersonalistikaAudit({
      userId,
      action: "sync:employees_from_users",
      tableName: "hr_employees",
      recordId: 0,
      newValues: result,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("Employees sync-from-users error:", e);
    return NextResponse.json({ error: "Synchronizace se nezdařila." }, { status: 500 });
  }
}

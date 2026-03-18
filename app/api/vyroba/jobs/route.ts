import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { JOB_TYPES, JOB_LABELS } from "@/lib/vyroba/config/fix-settings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "vyroba", "read"))) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  const jobs = JOB_TYPES.map((job) => ({
    id: job,
    label: JOB_LABELS[job] ?? job,
  }));

  return NextResponse.json({ jobs });
}

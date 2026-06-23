import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDepartmentMembers } from "@/lib/equipment-departments";

/** GET – členové oddělení podle názvu nebo kódu (např. IT, Vedení) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const name = decodeURIComponent((await params).name);
  if (!name) {
    return NextResponse.json({ error: "Chybí název oddělení" }, { status: 400 });
  }

  const members = await getDepartmentMembers(name);

  return NextResponse.json({ members });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPhoneListPayload } from "@/lib/phone-list-data";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") ?? "contacts";
  const search = searchParams.get("search")?.trim() ?? "";

  const payload = await getPhoneListPayload(tab, search);
  return NextResponse.json(payload);
}

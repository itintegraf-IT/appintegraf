import { NextRequest, NextResponse } from "next/server";
import { getPhoneListPayload } from "@/lib/phone-list-data";

/** Veřejný telefonní seznam (např. kiosk) – stejná data jako u přihlášeného bez auth. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") ?? "contacts";
  const search = searchParams.get("search")?.trim() ?? "";

  const payload = await getPhoneListPayload(tab, search);
  return NextResponse.json(payload);
}

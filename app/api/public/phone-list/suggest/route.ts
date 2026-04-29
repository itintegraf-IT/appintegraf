import { NextRequest, NextResponse } from "next/server";
import { buildPhoneListSuggestions, getPhoneListSuggestionsSyncMinLen } from "@/lib/phone-list-suggest-data";
import type { PhoneListSuggestRow } from "@/lib/phone-list-suggest-data";

export type { PhoneListSuggestRow };

/** Veřejné návrhy (kiosk) – stejná logika jako u přihlášeného, bez autentizace. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < getPhoneListSuggestionsSyncMinLen()) {
    return NextResponse.json({ suggestions: [] as PhoneListSuggestRow[] });
  }
  const suggestions = await buildPhoneListSuggestions(q);
  return NextResponse.json({ suggestions });
}

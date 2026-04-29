import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildPhoneListSuggestions, getPhoneListSuggestionsSyncMinLen } from "@/lib/phone-list-suggest-data";
import type { PhoneListSuggestRow } from "@/lib/phone-list-suggest-data";

export type { PhoneListSuggestRow };

/**
 * Návrhy pro telefonní seznam: osoby, oddělení, společné maily.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < getPhoneListSuggestionsSyncMinLen()) {
    return NextResponse.json({ suggestions: [] as PhoneListSuggestRow[] });
  }

  const suggestions = await buildPhoneListSuggestions(q);
  return NextResponse.json({ suggestions });
}

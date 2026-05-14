import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { getFilterOptionsMetadata } from "@/lib/personalistika-filters";
import { ensurePersonalistikaTables } from "@/lib/personalistika-db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "personalistika", "read"))) {
    return NextResponse.json({ error: "Nemáte přístup k modulu Personalistika." }, { status: 403 });
  }

  await ensurePersonalistikaTables();

  const positions = (await prisma.$queryRawUnsafe(
    `SELECT id, name, is_active FROM hr_positions ORDER BY name ASC`
  )) as { id: number; name: string; is_active: number }[];

  const cityRows = (await prisma.$queryRawUnsafe(
    `SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.correspondence_address.city')) AS city
     FROM hr_candidate_applications
     WHERE details_json IS NOT NULL
       AND JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.correspondence_address.city')) IS NOT NULL
       AND JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.correspondence_address.city')) != ''
     ORDER BY city ASC`
  )) as { city: string }[];

  const cities = cityRows.map((r) => r.city).filter(Boolean);

  return NextResponse.json({
    ...getFilterOptionsMetadata(),
    positions,
    cities,
  });
}

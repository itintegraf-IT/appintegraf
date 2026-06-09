import { requireCrmRead } from "@/lib/crm/guards";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorStatus, isAppError } from "@/lib/crm/errors";
import { logger } from "@/lib/crm/logger";

export async function GET(request: Request) {
  try {
    await requireCrmRead();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    if (q.length < 2) {
      return NextResponse.json({ companies: [], contacts: [], deals: [] });
    }

    const [companies, contacts, deals] = await Promise.all([
      prisma.crm_companies.findMany({
        where: { OR: [{ name: { contains: q } }, { ico: { contains: q } }] },
        select: { id: true, name: true, ico: true },
        take: 5,
      }),
      prisma.crm_contacts.findMany({
        where: {
          OR: [
            { first_name: { contains: q } },
            { last_name: { contains: q } },
            { email: { contains: q } },
          ],
        },
        select: { id: true, first_name: true, last_name: true, email: true },
        take: 5,
      }),
      prisma.crm_deals.findMany({
        where: { title: { contains: q } },
        select: { id: true, title: true, company: { select: { name: true } } },
        take: 5,
      }),
    ]);

    return NextResponse.json({ companies, contacts, deals });
  } catch (err) {
    if (isAppError(err)) {
      return NextResponse.json({ error: err.message }, { status: errorStatus(err.code) });
    }
    logger.error("[search] neočekávaná chyba", err instanceof Error ? err : { err });
    return NextResponse.json({ error: "Interní chyba serveru." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { JOB_TYPES } from "@/lib/vyroba/config/fix-settings";
import { importFromTxt } from "@/lib/vyroba/control/txt-io";

function isValidJob(job: string): job is (typeof JOB_TYPES)[number] {
  return JOB_TYPES.includes(job as (typeof JOB_TYPES)[number]);
}

function parseCislo(s: string): number {
  return parseInt(String(s).replace(/\s/g, ""), 10) || 0;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ job: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "vyroba", "write"))) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  const { job } = await params;
  if (!isValidJob(job)) {
    return NextResponse.json({ error: "Neplatný typ JOB" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const content = body.content as string;
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Chybí obsah TXT (content)" },
        { status: 400 }
      );
    }

    const jobConfig = await prisma.vyroba_job_config.findUnique({
      where: { job },
    });
    const ksVKr = jobConfig?.ks_v_krabici ?? 20;
    const prod = jobConfig?.prod ?? 6;

    const rows = importFromTxt(content, job === "IGT_Sazka", ksVKr, prod);

    for (let k = 0; k < rows.length; k++) {
      const r = rows[k];
      const od = parseCislo(r.cisloOd);
      const doVal = parseCislo(r.cisloDo);
      const ks = Math.max(0, Math.min(ksVKr, r.ks));

      await prisma.vyroba_box_state.upsert({
        where: { job_production: { job, production: k + 1 } },
        create: {
          job,
          production: k + 1,
          cislo_role: String(od),
          cislo_do: doVal,
          ks,
          ks_v_krabici: ksVKr,
        },
        update: {
          cislo_role: String(od),
          cislo_do: doVal,
          ks,
        },
      });
    }

    await prisma.vyroba_audit.create({
      data: {
        job,
        action: "import_txt",
        user_id: userId,
        details: { rowsCount: rows.length } as object,
      },
    });

    return NextResponse.json({ ok: true, rows: rows.length });
  } catch (error) {
    console.error("[POST /api/vyroba/control/[job]/import-txt]", error);
    return NextResponse.json({ error: "Chyba při importu" }, { status: 500 });
  }
}

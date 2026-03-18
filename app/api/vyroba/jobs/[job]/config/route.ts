import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { FIX_SETTINGS, JOB_TYPES } from "@/lib/vyroba/config/fix-settings";

function isValidJob(job: string): job is (typeof JOB_TYPES)[number] {
  return JOB_TYPES.includes(job as (typeof JOB_TYPES)[number]);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ job: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "vyroba", "read"))) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  const { job } = await params;
  if (!isValidJob(job)) {
    return NextResponse.json({ error: "Neplatný typ JOB" }, { status: 400 });
  }

  try {
    const fixConfig = FIX_SETTINGS[job];
    const varConfig = await prisma.vyroba_job_config.findUnique({
      where: { job },
    });

    const serie = (varConfig?.serie as string[] | null) ?? ["XB", "XC", "XD", "XE", "XF", "XG"];
    const predcisli =
      job === "IGT_Sazka"
        ? ((varConfig?.predcisli as string[] | null) ?? ["000", "010", "020", "030", "040", "050"])
        : undefined;

    return NextResponse.json({
      job,
      fix: fixConfig,
      var: {
        stav: varConfig?.stav ?? "Volny",
        serie,
        pocetCnaRoli: varConfig?.pocet_cna_roli ?? (job === "CD_POP" ? 180 : fixConfig.cisNaRoli === "x" ? null : fixConfig.cisNaRoli),
        ksVKr: varConfig?.ks_v_krabici ?? 20,
        prvniRole: varConfig?.prvni_role ?? 0,
        prvniJizd: varConfig?.prvni_jizd ?? 0,
        prod: varConfig?.prod ?? 6,
        skip: varConfig?.skip ?? undefined,
        predcisli,
        cisloZakazky: varConfig?.cislo_zakazky ?? undefined,
      },
    });
  } catch (error) {
    console.error("[GET /api/vyroba/jobs/[job]/config]", error);
    return NextResponse.json({ error: "Chyba při načítání konfigurace" }, { status: 500 });
  }
}

export async function PUT(
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

    const data = {
      stav: typeof body.stav === "string" ? body.stav : "Volny",
      serie: Array.isArray(body.serie) ? body.serie : ["XB", "XC", "XD", "XE", "XF", "XG"],
      pocet_cna_roli: typeof body.pocetCnaRoli === "number" ? body.pocetCnaRoli : body.pocetCnaRoli != null ? parseInt(String(body.pocetCnaRoli), 10) : null,
      ks_v_krabici: typeof body.ksVKr === "number" ? body.ksVKr : parseInt(String(body.ksVKr ?? 20), 10) || 20,
      prvni_role: typeof body.prvniRole === "number" ? body.prvniRole : parseInt(String(body.prvniRole ?? 0), 10) || 0,
      prvni_jizd: typeof body.prvniJizd === "number" ? body.prvniJizd : parseInt(String(body.prvniJizd ?? 0), 10) || 0,
      prod: typeof body.prod === "number" ? body.prod : parseInt(String(body.prod ?? 6), 10) || 6,
      skip: body.skip != null ? parseInt(String(body.skip), 10) : null,
      predcisli: Array.isArray(body.predcisli) ? body.predcisli : null,
      cislo_zakazky: typeof body.cisloZakazky === "string" ? body.cisloZakazky.trim() || null : null,
    };

    await prisma.vyroba_job_config.upsert({
      where: { job },
      create: { job, ...data },
      update: data,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PUT /api/vyroba/jobs/[job]/config]", error);
    return NextResponse.json({ error: "Chyba při ukládání konfigurace" }, { status: 500 });
  }
}

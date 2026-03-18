import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { generate, type JobType } from "@/lib/vyroba/generators";
import { JOB_TYPES } from "@/lib/vyroba/config/fix-settings";

function isValidJob(job: string): job is JobType {
  return JOB_TYPES.includes(job);
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
    const inputVal = body.pocetKS ?? body.pocetPredcisli ?? 0;
    const pocetKS = typeof inputVal === "number" ? inputVal : parseInt(String(inputVal), 10);
    const cislovaniVypnuto = Boolean(body.cislovaniVypnuto);

    if (!pocetKS || pocetKS < 1) {
      return NextResponse.json(
        { error: "Zadejte platný počet kusů nebo předčíslí" },
        { status: 400 }
      );
    }

    const [addressSetting, varConfig] = await Promise.all([
      prisma.vyroba_settings.findUnique({ where: { setting_key: "ADRESA" } }),
      prisma.vyroba_job_config.findUnique({ where: { job } }),
    ]);

    const adresa = addressSetting?.setting_val ?? process.env.VYROBA_OUTPUT_PATH ?? "";
    if (!adresa.trim()) {
      return NextResponse.json(
        { error: "Není nastavena ADRESA (cesta výstupů). Nastavte ji v Nastavení." },
        { status: 400 }
      );
    }

    const serie = Array.isArray(varConfig?.serie)
      ? (varConfig!.serie as string[])
      : ["XB", "XC", "XD", "XE", "XF", "XG"];
    const predcisli =
      job === "IGT_Sazka"
        ? (Array.isArray(varConfig?.predcisli)
            ? (varConfig!.predcisli as string[])
            : ["000", "010", "020", "030", "040", "050"])
        : undefined;

    const varConfigMapped = {
      serie,
      pocetCnaRoli:
        varConfig?.pocet_cna_roli ??
        (job === "CD_POP" ? 180 : job === "CD_POP_NEXGO" ? 160 : job === "CD_Vnitro" ? 1000 : job === "CD_Validator" ? 500 : job === "DPB_AVJ" ? 3600 : 3283),
      ksVKr: varConfig?.ks_v_krabici ?? 20,
      prvniRole: varConfig?.prvni_role ?? 0,
      prvniJizd: varConfig?.prvni_jizd ?? 0,
      prod: varConfig?.prod ?? 6,
      skip: varConfig?.skip ?? undefined,
      predcisli,
    };

    const result = generate(adresa, job, varConfigMapped, pocetKS, {
      cislovaniVypnuto,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Chyba při generování" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      csvPath: result.csvPath,
      txtPath: result.txtPath,
      pocetVyhozu: result.pocetVyhozu,
    });
  } catch (error) {
    console.error("[POST /api/vyroba/generate/[job]]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chyba při generování" },
      { status: 500 }
    );
  }
}

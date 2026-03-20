import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, getUsersWithModuleAccess } from "@/lib/auth-utils";
import { FIX_SETTINGS, JOB_TYPES } from "@/lib/vyroba/config/fix-settings";
import {
  initialRowsForJob,
  getCiselNaRoli,
  formatCislo,
} from "@/lib/vyroba/control/calculations";

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
    const [addressSetting, jobConfig, boxStates, vyrobaUsers] = await Promise.all([
      prisma.vyroba_settings.findUnique({ where: { setting_key: "ADRESA" } }),
      prisma.vyroba_job_config.findUnique({ where: { job } }),
      prisma.vyroba_box_state.findMany({ where: { job }, orderBy: { production: "asc" } }),
      getUsersWithModuleAccess("vyroba", "read"),
    ]);

    const address = addressSetting?.setting_val ?? "";
    const fix = FIX_SETTINGS[job];
    const pocCislic = fix?.pocCislic ?? 6;

    const serie = (jobConfig?.serie as string[]) ?? ["XB", "XC", "XD", "XE", "XF", "XG"];
    const predcisli =
      job === "IGT_Sazka"
        ? ((jobConfig?.predcisli as string[]) ?? ["000", "010", "020", "030", "040", "050"])
        : null;
    const ksVKr = jobConfig?.ks_v_krabici ?? 20;
    const prod = jobConfig?.prod ?? 6;
    const prvniJizd = jobConfig?.prvni_jizd ?? 0;
    const cisloZakazky = jobConfig?.cislo_zakazky ?? "";
    const skip = jobConfig?.skip ?? 0;
    const ciselNaRoli = getCiselNaRoli(job, jobConfig?.pocet_cna_roli ?? null);

    const defaultRows = initialRowsForJob(
      job,
      prvniJizd,
      ciselNaRoli,
      prod,
      skip,
      pocCislic
    );

    type BoxStateRow = (typeof boxStates)[number];
    const rows = Array.from({ length: prod }, (_, k) => {
      const state = boxStates.find((s: BoxStateRow) => s.production === k + 1);
      const def = defaultRows[k];
      const od = state?.cislo_role
        ? formatCislo(parseInt(state.cislo_role, 10), pocCislic)
        : def.cisloOd;
      const doVal =
        state?.cislo_do != null
          ? formatCislo(state.cislo_do, pocCislic)
          : def.cisloDo;
      return {
        checked: true,
        serie: serie[k] ?? "",
        predcisli: predcisli?.[k],
        cisloOd: od,
        cisloDo: doVal,
        ks: state?.ks ?? 0,
      };
    });

    const hotKrab = jobConfig?.hot_krab ?? 0;
    const pocetRoli = rows.reduce((s, r) => s + r.ks, 0);
    const celkem = pocetRoli + hotKrab * ksVKr;

    const isCD = ["CD_POP", "CD_POP_NEXGO", "CD_Vnitro", "CD_Validator"].includes(job);
    const stepBase = isCD ? ciselNaRoli : 1;

    return NextResponse.json({
      job,
      address,
      ksVKr,
      vyhoz: 0,
      hotKrab,
      pocetRoli,
      celkem,
      rows,
      cKrabNaPalete: 0,
      paleta: 1,
      cisloZakazky,
      employees: (vyrobaUsers as Array<{ name: string }>).map((u) => u.name),
      stepBase,
    });
  } catch (error) {
    console.error("[GET /api/vyroba/boxes/[job]]", error);
    return NextResponse.json({ error: "Chyba při načítání stavu" }, { status: 500 });
  }
}

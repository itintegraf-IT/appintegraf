import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { JOB_TYPES } from "@/lib/vyroba/config/fix-settings";
import { formatCislo } from "@/lib/vyroba/control/calculations";
import { exportToTxt } from "@/lib/vyroba/control/txt-io";

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
    const [jobConfig, boxStates] = await Promise.all([
      prisma.vyroba_job_config.findUnique({ where: { job } }),
      prisma.vyroba_box_state.findMany({ where: { job }, orderBy: { production: "asc" } }),
    ]);

    const serie = (jobConfig?.serie as string[]) ?? ["XB", "XC", "XD", "XE", "XF", "XG"];
    const predcisli =
      job === "IGT_Sazka"
        ? ((jobConfig?.predcisli as string[]) ?? ["000", "010", "020", "030", "040", "050"])
        : undefined;
    const ksVKr = jobConfig?.ks_v_krabici ?? 20;
    const prod = jobConfig?.prod ?? 6;
    const pocCislic = 6;

    type BoxStateRow = (typeof boxStates)[number];
    const rows = Array.from({ length: prod }, (_, k) => {
      const s = boxStates.find((x: BoxStateRow) => x.production === k + 1);
      const od = s?.cislo_role
        ? formatCislo(parseInt(s.cislo_role, 10), pocCislic)
        : "0";
      const doVal =
        s?.cislo_do != null ? formatCislo(s.cislo_do, pocCislic) : "0";
      return {
        ks: s?.ks ?? 0,
        serie: serie[k] ?? "",
        predcisli: predcisli?.[k],
        cisloOd: od,
        cisloDo: doVal,
      };
    });

    const content = exportToTxt(rows, ksVKr, job === "IGT_Sazka");

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="vyroba_${job}_export.txt"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/vyroba/control/[job]/export-txt]", error);
    return NextResponse.json({ error: "Chyba při exportu" }, { status: 500 });
  }
}

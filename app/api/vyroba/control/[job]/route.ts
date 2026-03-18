import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { JOB_TYPES } from "@/lib/vyroba/config/fix-settings";
import { getCiselNaRoli } from "@/lib/vyroba/control/calculations";
import { deleni3 } from "@/lib/vyroba/utils/deleni3";

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
    const action = body.action as string;

    if (action === "vyhoz") {
      const balil = body.balil as string;
      const rows = body.rows as Array<{
        checked: boolean;
        serie: string;
        predcisli?: string;
        cisloOd: string;
        cisloDo: string;
        ks: number;
      }>;
      const cisloZakazky = (body.cisloZakazky as string) ?? "";
      const turbo = !!body.turbo;

      if (!balil || balil === "Vyber jmeno...") {
        return NextResponse.json({ error: "Vyber jméno" }, { status: 400 });
      }

      if (job === "IGT_Sazka" && !cisloZakazky.trim()) {
        return NextResponse.json(
          { error: "Zadej číslo zakázky" },
          { status: 400 }
        );
      }

      const jobConfig = await prisma.vyroba_job_config.findUnique({
        where: { job },
      });
      const ksVKr = jobConfig?.ks_v_krabici ?? 20;
      const prod = jobConfig?.prod ?? 6;
      const ciselNaRoli = getCiselNaRoli(job, jobConfig?.pocet_cna_roli ?? null);

      const cyklus = turbo ? ksVKr : 1;
      const formatCislo = (val: number) =>
        deleni3(String(val).padStart(6, "0"));

      let currentRows = rows.map((r) => ({
        ...r,
        cisloOd: r.cisloOd,
        cisloDo: r.cisloDo,
        ks: r.ks ?? 0,
      }));

      for (let i = 0; i < cyklus; i++) {
        for (let k = 0; k < prod; k++) {
          const row = currentRows[k];
          if (!row?.checked) continue;

          const cisloDo = parseCislo(row.cisloDo);
          const newCisloOd = cisloDo - 1;
          const newCisloDo = newCisloOd - ciselNaRoli;
          let newKs = row.ks + 1;
          if (newKs >= ksVKr) newKs = 0;

          currentRows[k] = {
            ...row,
            cisloOd: formatCislo(newCisloOd),
            cisloDo: formatCislo(newCisloDo),
            ks: newKs,
          };

          await prisma.vyroba_box_state.upsert({
            where: {
              job_production: { job, production: k + 1 },
            },
            create: {
              job,
              production: k + 1,
              cislo_role: String(newCisloOd),
              cislo_do: newCisloDo,
              ks: newKs,
              ks_v_krabici: ksVKr,
            },
            update: {
              cislo_role: String(newCisloOd),
              cislo_do: newCisloDo,
              ks: newKs,
            },
          });
        }
      }

      await prisma.vyroba_audit.create({
        data: {
          job,
          action: "vyhoz",
          user_id: userId,
          details: { balil, cisloZakazky, turbo } as object,
        },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Neznámá akce" }, { status: 400 });
  } catch (error) {
    console.error("[POST /api/vyroba/control/[job]]", error);
    return NextResponse.json(
      { error: "Chyba při zpracování" },
      { status: 500 }
    );
  }
}

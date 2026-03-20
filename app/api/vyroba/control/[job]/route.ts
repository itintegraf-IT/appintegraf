import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { JOB_TYPES } from "@/lib/vyroba/config/fix-settings";
import { getCiselNaRoli } from "@/lib/vyroba/control/calculations";
import { deleni3 } from "@/lib/vyroba/utils/deleni3";
import {
  isCdJob,
  generateProtocolPdf,
} from "@/lib/vyroba/protocol";

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

    if (action === "opravit") {
      const rows = body.rows as Array<{
        cisloOd: string;
        cisloDo: string;
        ks: number;
      }>;
      if (!Array.isArray(rows)) {
        return NextResponse.json({ error: "Chybí řádky" }, { status: 400 });
      }
      const jobConfig = await prisma.vyroba_job_config.findUnique({
        where: { job },
      });
      const prod = jobConfig?.prod ?? 6;
      const ksVKr = jobConfig?.ks_v_krabici ?? 20;
      const pocCislic = 6;
      for (let k = 0; k < Math.min(prod, rows.length); k++) {
        const r = rows[k];
        const od = parseCislo(r?.cisloOd ?? "0");
        const doVal = parseCislo(r?.cisloDo ?? "0");
        const ks = Math.max(0, Math.min(ksVKr, r?.ks ?? 0));
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
        data: { job, action: "opravit", user_id: userId, details: {} as object },
      });
      return NextResponse.json({ ok: true });
    }

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

      type RowType = (typeof rows)[number];
      let currentRows = rows.map((r: RowType) => ({
        ...r,
        cisloOd: r.cisloOd,
        cisloDo: r.cisloDo,
        ks: r.ks ?? 0,
      }));

      let hotKrabDelta = 0;
      let rowsForProtocol: typeof currentRows | null = null;
      const cKrabNaPalete = String(body.cKrabNaPalete ?? "").trim() || "  ";

      for (let i = 0; i < cyklus; i++) {
        const rowsBeforeIter = currentRows.map((r: RowType) => ({ ...r }));

        for (let k = 0; k < prod; k++) {
          const row = currentRows[k];
          if (!row?.checked) continue;

          const cisloDo = parseCislo(row.cisloDo);
          const newCisloOd = cisloDo - 1;
          const newCisloDo = newCisloOd - ciselNaRoli;
          let newKs = row.ks + 1;
          const boxFull = newKs >= ksVKr;
          if (boxFull) {
            if (!rowsForProtocol) rowsForProtocol = rowsBeforeIter;
            newKs = 0;
            hotKrabDelta++;
          }

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

      if (hotKrabDelta > 0) {
        const cfg = await prisma.vyroba_job_config.update({
          where: { job },
          data: { hot_krab: { increment: hotKrabDelta } },
        });
        const newHotKrab = cfg.hot_krab;

        if (
          isCdJob(job) &&
          rowsForProtocol &&
          rowsForProtocol.length > 0
        ) {
          try {
            const protocolRows = rowsForProtocol.map((r: RowType) => ({
              serie: r.serie ?? "",
              cisloOd: r.cisloOd ?? "",
              cisloDo: r.cisloDo ?? "",
              ks: r.ks ?? 0,
            }));
            const serie = protocolRows[0]?.serie ?? "";
            const pdfBytes = await generateProtocolPdf(
              {
                job,
                cisloKrabice: String(newHotKrab),
                cKrabNaPalete,
                balil,
                rows: protocolRows,
              },
              {
                job,
                cisloKrabice: String(newHotKrab),
                cKrabNaPalete,
                balil,
                serie,
                rows: protocolRows,
              }
            );
            const base64 = Buffer.from(pdfBytes).toString("base64");
            await prisma.vyroba_audit.create({
              data: {
                job,
                action: "vyhoz",
                user_id: userId,
                details: { balil, cisloZakazky, turbo } as object,
              },
            });
            return NextResponse.json({
              ok: true,
              protocolPdf: base64,
              hotKrab: newHotKrab,
            });
          } catch (err) {
            console.error("[vyhoz] protokol:", err);
          }
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

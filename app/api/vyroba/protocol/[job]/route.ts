import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { JOB_TYPES } from "@/lib/vyroba/config/fix-settings";
import {
  isCdJob,
  isIgtJob,
  generateProtocolPdf,
  generateBalnyListOnly,
  generateStitekOnly,
  generateIgtPaletaPdf,
  generateIgtInkjetyTxt,
} from "@/lib/vyroba/protocol";

function isValidJob(job: string): job is (typeof JOB_TYPES)[number] {
  return JOB_TYPES.includes(job as (typeof JOB_TYPES)[number]);
}

type ProtocolRow = {
  serie: string;
  predcisli?: string;
  cisloOd: string;
  cisloDo: string;
  ks: number;
};

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
    const type = (body.type as string) ?? "both";

    if (isCdJob(job)) {
      const balil = (body.balil as string) ?? "";
      const cKrabNaPalete = String(body.cKrabNaPalete ?? "").trim() || "  ";
      const cisloKrabice = String(body.cisloKrabice ?? body.hotKrab ?? 0);
      const rows = (body.rows as ProtocolRow[]) ?? [];

      const protocolRows = rows.map((r) => ({
        serie: r.serie ?? "",
        cisloOd: r.cisloOd ?? "",
        cisloDo: r.cisloDo ?? "",
        ks: r.ks ?? 0,
      }));

      const serie = protocolRows[0]?.serie ?? "";

      const balnyListInput = {
        job,
        cisloKrabice,
        cKrabNaPalete,
        balil,
        rows: protocolRows,
      };
      const stitekInput = {
        job,
        cisloKrabice,
        cKrabNaPalete,
        balil,
        serie,
        rows: protocolRows,
      };

      if (type === "balny-list") {
        const pdfBytes = await generateBalnyListOnly(balnyListInput);
        return new NextResponse(Buffer.from(pdfBytes), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="balny-list_${cisloKrabice}.pdf"`,
          },
        });
      }
      if (type === "stitek") {
        const pdfBytes = await generateStitekOnly(stitekInput);
        return new NextResponse(Buffer.from(pdfBytes), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="stitek_${cisloKrabice}.pdf"`,
          },
        });
      }
      const pdfBytes = await generateProtocolPdf(balnyListInput, stitekInput);
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="protokol_${cisloKrabice}.pdf"`,
        },
      });
    }

    if (isIgtJob(job)) {
      const cisloZakazky = (body.cisloZakazky as string) ?? "";
      const cisloPalety = String(body.cisloPalety ?? 1);
      const boxes = (body.boxes as Array<{
        cisloKrabice: string;
        cisloPalety: string;
        serie: string;
        rows: ProtocolRow[];
      }>) ?? [];

      if (type === "igt-paleta") {
        const paletaInput = {
          cisloZakazky,
          cisloPalety,
          boxes: boxes.map((b) => ({
            cisloKrabice: b.cisloKrabice,
            cisloPalety: b.cisloPalety,
            rows: (b.rows ?? []).map((r) => ({
              serie: r.serie ?? "",
              cisloOd: r.cisloOd ?? "",
              cisloDo: r.cisloDo ?? "",
              ks: r.ks ?? 0,
            })),
          })),
        };
        const pdfBytes = await generateIgtPaletaPdf(paletaInput);
        return new NextResponse(Buffer.from(pdfBytes), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="paleta_${cisloZakazky}_${cisloPalety}.pdf"`,
          },
        });
      }

      if (type === "igt-inkjety") {
        const inkjetyInput = {
          boxes: boxes.map((b) => ({
            cisloKrabice: b.cisloKrabice,
            cisloPalety: b.cisloPalety,
            serie: b.serie ?? "",
            rows: (b.rows ?? []).map((r) => ({
              serie: r.serie ?? "",
              cisloOd: r.cisloOd ?? "",
              cisloDo: r.cisloDo ?? "",
              ks: r.ks ?? 0,
            })),
          })),
        };
        const txt = generateIgtInkjetyTxt(inkjetyInput);
        return new NextResponse(txt, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="inkjety_${cisloZakazky}.txt"`,
          },
        });
      }
    }

    return NextResponse.json({ error: "Neznámý typ protokolu" }, { status: 400 });
  } catch (error) {
    console.error("[POST /api/vyroba/protocol/[job]]", error);
    return NextResponse.json(
      { error: "Chyba při generování protokolu" },
      { status: 500 }
    );
  }
}

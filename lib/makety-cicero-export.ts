import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { MAKETY_FILE_MODULE } from "@/lib/makety-files";
import {
  buildMaketyCiceroXml,
  ciceroExportFileName,
  type MaketyCiceroXmlPayload,
} from "@/lib/makety-cicero-xml";

function personName(
  u: { first_name: string; last_name: string } | null | undefined
): string | null {
  if (!u) return null;
  return `${u.first_name} ${u.last_name}`.trim() || null;
}

export async function loadMaketyCiceroPayload(
  maketaId: number
): Promise<MaketyCiceroXmlPayload | null> {
  const maketa = await prisma.makety.findFirst({
    where: { id: maketaId, work_type: "grafika" },
    include: {
      iml_customers: { select: { name: true, email: true } },
      iml_products: { select: { ig_code: true } },
      iml_die_cuts: {
        select: { label_shape_code: true, die_cut_tool_code: true },
      },
      users_assignee: { select: { first_name: true, last_name: true } },
      users_prepress: { select: { first_name: true, last_name: true } },
      users_final_approver: { select: { first_name: true, last_name: true } },
    },
  });
  if (!maketa) return null;

  const files = await prisma.file_uploads.findMany({
    where: { module: MAKETY_FILE_MODULE, record_id: maketaId, archived_at: null },
    select: { original_filename: true },
    orderBy: { id: "asc" },
  });

  const die =
    maketa.iml_die_cuts?.die_cut_tool_code ||
    maketa.iml_die_cuts?.label_shape_code ||
    null;

  return {
    maketaId: maketa.id,
    jobNumber: maketa.job_number,
    orderNumber: maketa.order_number,
    labelCode: maketa.label_code,
    status: maketa.status,
    body: maketa.body,
    dueAt: maketa.due_at,
    customerName: maketa.iml_customers?.name ?? null,
    customerEmail: maketa.iml_customers?.email ?? null,
    productIgCode: maketa.iml_products?.ig_code ?? null,
    dieCutCode: die,
    assigneeName: personName(maketa.users_assignee),
    prepressName: personName(maketa.users_prepress),
    finalApproverName: personName(maketa.users_final_approver),
    fileNames: files.map((f) => f.original_filename),
  };
}

export function getCiceroExportDir(): string | null {
  const dir = process.env.CICERO_EXPORT_DIR?.trim();
  return dir || null;
}

/** Zapíše XML do CICERO_EXPORT_DIR. Bez nastavené složky vrací null (jen obsah). */
export async function exportMaketyCiceroXml(
  maketaId: number
): Promise<
  | { ok: true; xml: string; fileName: string; savedPath: string | null }
  | { ok: false; error: string }
> {
  const payload = await loadMaketyCiceroPayload(maketaId);
  if (!payload) {
    return { ok: false, error: "Zakázka nenalezena" };
  }

  const xml = buildMaketyCiceroXml(payload);
  const fileName = ciceroExportFileName(payload);
  const exportDir = getCiceroExportDir();
  let savedPath: string | null = null;

  if (exportDir) {
    await mkdir(exportDir, { recursive: true });
    savedPath = path.join(exportDir, fileName);
    await writeFile(savedPath, xml, "utf-8");
  }

  return { ok: true, xml, fileName, savedPath };
}

/**
 * Minimální XML export grafické zakázky pro Cicero.
 * TODO: upřesnit elementy dle finální specifikace dodavatele.
 */

import { escapeXml } from "@/lib/iml-xml";
import { grafikaStatusLabel } from "@/lib/makety-grafika-status";

export type MaketyCiceroXmlPayload = {
  maketaId: number;
  jobNumber: string | null;
  orderNumber: string | null;
  labelCode: string | null;
  status: string;
  body: string;
  dueAt: Date;
  customerName: string | null;
  customerEmail: string | null;
  productIgCode: string | null;
  dieCutCode: string | null;
  assigneeName: string | null;
  prepressName: string | null;
  finalApproverName: string | null;
  fileNames: string[];
};

export function buildMaketyCiceroXml(payload: MaketyCiceroXmlPayload): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push("<GraphicJob>");
  lines.push("  <Header>");
  lines.push(`    <InternalId>${payload.maketaId}</InternalId>`);
  lines.push(
    `    <JobNumber>${escapeXml(payload.jobNumber ?? payload.orderNumber ?? "")}</JobNumber>`
  );
  lines.push(`    <LabelCode>${escapeXml(payload.labelCode ?? "")}</LabelCode>`);
  lines.push(`    <Status>${escapeXml(grafikaStatusLabel(payload.status))}</Status>`);
  lines.push(`    <StatusCode>${escapeXml(payload.status)}</StatusCode>`);
  lines.push(`    <DueAt>${escapeXml(payload.dueAt.toISOString())}</DueAt>`);
  lines.push("  </Header>");
  lines.push("  <Customer>");
  lines.push(`    <Name>${escapeXml(payload.customerName ?? "")}</Name>`);
  lines.push(`    <Email>${escapeXml(payload.customerEmail ?? "")}</Email>`);
  lines.push("  </Customer>");
  lines.push("  <Product>");
  lines.push(`    <IgCode>${escapeXml(payload.productIgCode ?? "")}</IgCode>`);
  lines.push(`    <DieCutCode>${escapeXml(payload.dieCutCode ?? "")}</DieCutCode>`);
  lines.push("  </Product>");
  lines.push("  <Workflow>");
  lines.push(`    <Assignee>${escapeXml(payload.assigneeName ?? "")}</Assignee>`);
  lines.push(`    <Prepress>${escapeXml(payload.prepressName ?? "")}</Prepress>`);
  lines.push(
    `    <FinalApprover>${escapeXml(payload.finalApproverName ?? "")}</FinalApprover>`
  );
  lines.push("  </Workflow>");
  lines.push(`  <Notes>${escapeXml(payload.body.slice(0, 2000))}</Notes>`);
  lines.push("  <Files>");
  for (const name of payload.fileNames) {
    lines.push(`    <File>${escapeXml(name)}</File>`);
  }
  lines.push("  </Files>");
  lines.push("</GraphicJob>");
  return lines.join("\n");
}

export function ciceroExportFileName(payload: MaketyCiceroXmlPayload): string {
  const key =
    (payload.jobNumber || payload.orderNumber || `maketa-${payload.maketaId}`)
      .replace(/[^\w.-]+/g, "_")
      .slice(0, 80) || `maketa-${payload.maketaId}`;
  return `grafika_${key}_${payload.maketaId}.xml`;
}

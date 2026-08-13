"use client";

import { ImlOrderTemplateExportButton } from "../ImlOrderTemplateExportButton";

export function ImlOrderDetailTemplateExport({ orderId }: { orderId: number }) {
  return <ImlOrderTemplateExportButton orderIds={[orderId]} label="Export šablonou" />;
}

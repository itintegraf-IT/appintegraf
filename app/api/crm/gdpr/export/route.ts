import { NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { requireCrmAdmin } from "@/lib/crm/guards";
import {
  GdprRequestSchema,
  buildCompanyExport,
  buildContactExport,
  buildUserExport,
} from "@/lib/crm/gdpr";
import { AppError } from "@/lib/crm/errors";
import { logger } from "@/lib/crm/logger";

export const POST = withApiError(async (req: Request) => {
  const user = await requireCrmAdmin();
  const body: unknown = await req.json().catch(() => null);
  const parsed = GdprRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Neplatný požadavek.");
  }

  const { entityType, entityId } = parsed.data;
  const exportData =
    entityType === "COMPANY"
      ? await buildCompanyExport(entityId)
      : entityType === "CONTACT"
        ? await buildContactExport(entityId)
        : await buildUserExport(entityId);

  logger.info("[crm-gdpr] export", {
    adminId: user.id,
    entityType,
    entityId,
  });

  const fileName = `gdpr-export-${entityType.toLowerCase()}-${entityId}-${Date.now()}.json`;
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiError } from "@/lib/crm/api-utils";
import { requireCrmAdmin } from "@/lib/crm/guards";
import { GdprRequestSchema, cascadeDeleteCompany, cascadeDeleteContact } from "@/lib/crm/gdpr";
import { AppError } from "@/lib/crm/errors";
import { logger } from "@/lib/crm/logger";

const DeleteSchema = GdprRequestSchema.extend({
  confirm: z.literal("SMAZAT", { message: "Pro potvrzení zadej přesně 'SMAZAT'." }),
});

export const POST = withApiError(async (req: Request) => {
  const user = await requireCrmAdmin();
  const body: unknown = await req.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Neplatný požadavek.");
  }

  const { entityType, entityId } = parsed.data;

  if (entityType === "USER") {
    throw new AppError(
      "VALIDATION",
      "Mazání uživatelů probíhá přes /admin/users (včetně auditu a reasigmentu vlastnictví)."
    );
  }

  if (entityType === "COMPANY") {
    await cascadeDeleteCompany(entityId, user.id);
  } else {
    await cascadeDeleteContact(entityId, user.id);
  }

  logger.info("[crm-gdpr] delete", {
    adminId: user.id,
    entityType,
    entityId,
  });

  return NextResponse.json({ ok: true, entityType, entityId });
});

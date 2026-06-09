import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiError } from "@/lib/crm/api-utils";
import { requireCrmAdmin } from "@/lib/crm/guards";
import { AppError } from "@/lib/crm/errors";
import { syncUser } from "@/lib/crm/graph/sync-user";

const BodySchema = z.object({
  userId: z.coerce.number().int().positive(),
});

export const POST = withApiError(async (req: NextRequest) => {
  await requireCrmAdmin();
  const body: unknown = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.message);

  const result = await syncUser(parsed.data.userId);
  return NextResponse.json(result);
});

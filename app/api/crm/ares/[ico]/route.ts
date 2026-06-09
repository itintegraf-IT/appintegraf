import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { NextResponse } from "next/server";
import { lookupAres } from "@/lib/crm/ares";
import { withApiError } from "@/lib/crm/api-utils";

export const GET = withApiError(
  async (_req: Request, { params }: { params: Promise<{ ico: string }> }) => {
    await requireCrmRead();
    const { ico } = await params;
    return NextResponse.json(await lookupAres(ico));
  },
);

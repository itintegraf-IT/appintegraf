import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageItVendorRequests } from "@/lib/it-vendor-request/access";
import {
  assignIpManually,
  NetworkAllocationError,
} from "@/lib/it-network/registry";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  device_kind: z.string().max(80).optional().nullable(),
  label: z.string().max(150).optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  release: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageItVendorRequests(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await ctx.params).id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }

  try {
    const item = await assignIpManually(id, parsed.data);
    return NextResponse.json({ success: true, item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba";
    if (e instanceof NetworkAllocationError) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error("it-network ips PATCH:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

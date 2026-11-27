import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageItVendorRequests } from "@/lib/it-vendor-request/access";
import {
  createSubnetWithIps,
  NetworkAllocationError,
} from "@/lib/it-network/registry";
import { z } from "zod";

const createSchema = z.object({
  vlan_id: z.number().int().positive(),
  cidr: z.string().trim().min(7).max(50),
  gateway: z.string().max(50).optional().nullable(),
  note: z.string().max(4000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageItVendorRequests(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }

  try {
    const item = await createSubnetWithIps(parsed.data);
    return NextResponse.json({ success: true, item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba";
    if (e instanceof NetworkAllocationError) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (String(msg).toLowerCase().includes("unique")) {
      return NextResponse.json({ error: "Subnet (CIDR) už existuje" }, { status: 409 });
    }
    console.error("it-network subnets POST:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

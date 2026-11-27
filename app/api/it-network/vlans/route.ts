import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageItVendorRequests } from "@/lib/it-vendor-request/access";
import { createVlan, listVlansWithStats } from "@/lib/it-network/registry";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageItVendorRequests(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const items = await listVlansWithStats();
  return NextResponse.json({ items });
}

const createSchema = z.object({
  vlan_number: z.number().int().min(1).max(4094),
  name: z.string().trim().min(1).max(150),
  description: z.string().max(4000).optional().nullable(),
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
    const item = await createVlan(parsed.data);
    return NextResponse.json({ success: true, item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba";
    if (String(msg).toLowerCase().includes("unique")) {
      return NextResponse.json({ error: "VLAN s tímto číslem už existuje" }, { status: 409 });
    }
    console.error("it-network vlans POST:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageItVendorRequests } from "@/lib/it-vendor-request/access";
import { NETWORK_DEVICE_KINDS } from "@/lib/it-network/registry";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageItVendorRequests(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }
  return NextResponse.json({ device_kinds: NETWORK_DEVICE_KINDS });
}

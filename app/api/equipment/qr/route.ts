import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canReadEquipment } from "@/lib/equipment/access";
import { generateQrPng, buildEqPayload, buildRmPayload, parseEquipmentScanCode } from "@/lib/equipment/qr";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const code = req.nextUrl.searchParams.get("code") ?? "";
  const type = req.nextUrl.searchParams.get("type") ?? "eq";
  if (!code.trim()) {
    return NextResponse.json({ error: "Chybí code" }, { status: 400 });
  }

  const parsed = parseEquipmentScanCode(code);
  let payload: string;
  if (parsed.kind === "rm" || type === "rm") {
    payload = buildRmPayload(parsed.code || code);
  } else {
    payload = buildEqPayload(parsed.code || code);
  }

  const png = await generateQrPng(payload);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

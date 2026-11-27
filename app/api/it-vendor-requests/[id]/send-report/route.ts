import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendItVendorReportEmail } from "@/lib/email";
import { canManageItVendorRequests } from "@/lib/it-vendor-request/access";
import {
  buildItVendorReportHtml,
  loadItVendorReport,
} from "@/lib/it-vendor-request/report";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  email: z.string().email().max(190).optional(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
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

  const data = await loadItVendorReport(id);
  if (!data) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }

  const email = (
    parsed.data.email ||
    data.contact_email ||
    data.contacts?.find((c) => c.email)?.email ||
    ""
  ).trim();
  if (!email) {
    return NextResponse.json(
      { error: "Zadejte e-mail příjemce" },
      { status: 400 }
    );
  }

  const reportHtml = buildItVendorReportHtml(data);
  const mail = await sendItVendorReportEmail({
    toEmail: email,
    toName:
      data.contact_name ||
      data.contacts?.find((c) => c.name)?.name ||
      data.vendor_company ||
      "dodavateli",
    requestNumber: data.request_number,
    projectName: data.project_name,
    reportHtml,
    approved: data.status === "approved",
  });

  if (!mail.success) {
    return NextResponse.json(
      { error: mail.error ?? "Odeslání e-mailu selhalo" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Report odeslán na ${email}`,
  });
}

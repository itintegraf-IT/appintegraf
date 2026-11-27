import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { sendItVendorRequestLinkEmail } from "@/lib/email";
import { canManageItVendorRequests } from "@/lib/it-vendor-request/access";
import { createItVendorLink } from "@/lib/it-vendor-request/tokens";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

function getBaseUrl(req: NextRequest): string {
  const explicit =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return req.nextUrl.origin;
}

const bodySchema = z.object({
  email: z.string().email().max(190).optional(),
  message: z.string().max(2000).optional().nullable(),
  copy_only: z.boolean().optional(),
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

  const row = await prisma.it_vendor_requests.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }
  if (row.status === "cancelled" || row.status === "approved") {
    return NextResponse.json(
      { error: "Na schválený nebo zrušený požadavek nelze odeslat odkaz" },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }

  const email = (parsed.data.email || row.contact_email || "").trim();
  if (!email) {
    return NextResponse.json(
      { error: "Zadejte e-mail dodavatele" },
      { status: 400 }
    );
  }

  try {
    const { rawToken, expiresAt } = await createItVendorLink({
      requestId: id,
      sentToEmail: email,
      createdBy: userId,
    });

    const pageUrl = `${getBaseUrl(req)}/public/it-vendor-request/${encodeURIComponent(rawToken)}`;

    if (row.status === "draft" || row.status === "rejected") {
      await prisma.it_vendor_requests.update({
        where: { id },
        data: {
          status: "sent",
          contact_email: row.contact_email || email,
          updated_at: new Date(),
        },
      });
    } else if (!row.contact_email) {
      await prisma.it_vendor_requests.update({
        where: { id },
        data: { contact_email: email, updated_at: new Date() },
      });
    }

    let emailSent = false;
    if (!parsed.data.copy_only) {
      const mail = await sendItVendorRequestLinkEmail({
        toEmail: email,
        toName: row.contact_name || row.vendor_company || "dodavateli",
        requestNumber: row.request_number,
        projectName: row.project_name,
        dueDate: row.due_date ? row.due_date.toISOString().slice(0, 10) : null,
        pageUrl,
        message: parsed.data.message,
      });
      if (!mail.success) {
        return NextResponse.json(
          {
            success: true,
            pageUrl,
            expiresAt: expiresAt.toISOString(),
            emailSent: false,
            emailError: mail.error,
          },
          { status: 200 }
        );
      }
      emailSent = true;
    }

    return NextResponse.json({
      success: true,
      pageUrl,
      expiresAt: expiresAt.toISOString(),
      emailSent,
    });
  } catch (e) {
    console.error("it-vendor send-link:", e);
    return NextResponse.json({ error: "Chyba při vytváření odkazu" }, { status: 500 });
  }
}

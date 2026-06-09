import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";
import { fileTypeFromBuffer } from "file-type";
import { withApiError } from "@/lib/crm/api-utils";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/crm/errors";
import { canAccessParent } from "@/lib/crm/rbac";
import { AttachmentMetaSchema, ALLOWED_MIME, MAX_UPLOAD_BYTES } from "@/lib/crm/validators/attachment";
import { saveAttachment } from "@/lib/crm/file-storage";
import type { crm_parent_type } from "@prisma/client";

// Typy, které sniffer file-type nedetekuje (textový/exotický binární formát).
// Pro tyto akceptujeme client-supplied MIME, pokud je v ALLOWED_MIME.
const SNIFF_BYPASS_MIME = new Set(["message/rfc822", "application/vnd.ms-outlook"]);

export const GET = withApiError(async (req: NextRequest) => {
  const user = await requireCrmRead();
  const url = new URL(req.url);
  const parent_type = url.searchParams.get("parent_type") as crm_parent_type | null;
  const parent_id = url.searchParams.get("parent_id");
  if (!parent_type || !parent_id) throw new AppError("VALIDATION", "parent_type + parent_id povinné.");
  const ok = await canAccessParent(user, parent_type, parent_id);
  if (!ok) throw new AppError("FORBIDDEN", "Nemáš přístup.");
  const attachments = await prisma.crm_attachments.findMany({
    where: { parent_type, parent_id },
    include: { uploader: { select: { first_name: true, last_name: true, email: true } } },
    orderBy: { created_at: "desc" },
  });
  return NextResponse.json({ attachments });
});

export const POST = withApiError(async (req: NextRequest) => {
  const user = await requireCrmRead();
  if (user.role === "VIEWER") throw new AppError("FORBIDDEN", "Viewer nemůže nahrávat.");
  const form = await req.formData();
  const meta = AttachmentMetaSchema.safeParse({
    parent_type: form.get("parent_type"),
    parent_id: form.get("parent_id"),
  });
  if (!meta.success) throw new AppError("VALIDATION", meta.error.message);
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION", "Soubor chybí.");
  if (file.size === 0) throw new AppError("VALIDATION", "Prázdný soubor.");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("VALIDATION", "Soubor je větší než 25 MB.");
  if (!ALLOWED_MIME.has(file.type)) {
    throw new AppError("VALIDATION", `Typ ${file.type} není povolený.`);
  }
  const ok = await canAccessParent(user, meta.data.parent_type, meta.data.parent_id, "write");
  if (!ok) throw new AppError("FORBIDDEN", "Nemáš přístup.");

  const buffer = Buffer.from(await file.arrayBuffer());

  // Server-side MIME sniffing — neslepě věřit klientskému `file.type`.
  const sniffed = await fileTypeFromBuffer(buffer);
  let verifiedMime: string;
  if (sniffed) {
    if (!ALLOWED_MIME.has(sniffed.mime)) {
      throw new AppError("VALIDATION", `Detekovaný typ ${sniffed.mime} není povolený.`);
    }
    verifiedMime = sniffed.mime;
  } else if (SNIFF_BYPASS_MIME.has(file.type)) {
    verifiedMime = file.type;
  } else {
    throw new AppError("VALIDATION", "Nepodařilo se ověřit typ souboru.");
  }

  const saved = await saveAttachment(buffer, file.name, verifiedMime);

  const attachment = await prisma.crm_attachments.create({
    data: {
      parent_type: meta.data.parent_type,
      parent_id: meta.data.parent_id,
      file_name: file.name,
      path: saved.path,
      size: saved.size,
      mime: verifiedMime,
      uploaded_by: user.id,
    },
  });
  return NextResponse.json({ attachment }, { status: 201 });
});

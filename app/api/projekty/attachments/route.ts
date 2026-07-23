import { NextRequest, NextResponse } from "next/server";
import { fileTypeFromBuffer } from "file-type";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { prisma } from "@/lib/projekty/prisma";
import { AppError } from "@/lib/projekty/errors";
import { canEditCard, canViewCard } from "@/lib/projekty/rbac";
import { loadCardForRBAC } from "@/lib/projekty/board-rbac";
import { AttachmentMetaSchema, ALLOWED_MIME, MAX_UPLOAD_BYTES } from "@/lib/projekty/validators/attachment";
import { projektyUserSelect, toDisplayUser } from "@/lib/projekty/user-display";
import type { ParentType } from "@prisma/client";

// Typy, které sniffer file-type nedetekuje (textový/exotický binární formát).
// Pro tyto akceptujeme client-supplied MIME, pokud je v ALLOWED_MIME.
const SNIFF_BYPASS_MIME = new Set(["message/rfc822", "application/vnd.ms-outlook"]);

// Legacy Office (CFB/OLE2) — file-type vrací pro .doc/.xls/.msg generické
// `application/x-cfb` a neumí rozlišit konkrétní typ. Když sniff vrátí x-cfb
// a klient deklaroval jeden z těchto povolených typů, věříme deklaraci.
const CFB_MIME = "application/x-cfb";
const CFB_DECLARED_MIME = new Set([
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-outlook",
]);

export const GET = withApiError(async (req: NextRequest) => {
  const user = await requireSession();
  const url = new URL(req.url);
  const parentType = url.searchParams.get("parentType") as ParentType | null;
  const parentId = url.searchParams.get("parentId");
  if (!parentType || !parentId) throw new AppError("VALIDATION", "parentType + parentId povinné.");
  // Jediný podporovaný parent je CARD (jinak by neplatná enum hodnota shodila dotaz 500
  // a obešla RBAC kontrolu níže).
  if (parentType !== "CARD") throw new AppError("VALIDATION", "Nepodporovaný parentType.");
  const card = await loadCardForRBAC(parentId);
  if (!canViewCard(user, card)) throw new AppError("FORBIDDEN", "Nemáš přístup k této kartě.");
  const rawAttachments = await prisma.attachment.findMany({
    where: { parentType, parentId },
    // Pozor: NEvybírat `data` (BLOB) do seznamu — jen metadata.
    select: {
      id: true,
      parentType: true,
      parentId: true,
      fileName: true,
      size: true,
      mime: true,
      uploadedBy: true,
      createdAt: true,
      uploader: { select: projektyUserSelect },
    },
    orderBy: { createdAt: "desc" },
  });
  const attachments = rawAttachments.map((a) => ({
    ...a,
    uploader: a.uploader ? toDisplayUser(a.uploader) : null,
  }));
  return NextResponse.json({ attachments });
});

export const POST = withApiError(async (req: NextRequest) => {
  const user = await requireSession();
  if (user.role === "VIEWER") throw new AppError("FORBIDDEN", "Viewer nemůže nahrávat.");
  const form = await req.formData();
  const meta = AttachmentMetaSchema.safeParse({
    parentType: form.get("parentType"),
    parentId: form.get("parentId"),
  });
  if (!meta.success) throw new AppError("VALIDATION", meta.error.message);
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION", "Soubor chybí.");
  if (file.size === 0) throw new AppError("VALIDATION", "Prázdný soubor.");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("VALIDATION", "Soubor je větší než 25 MB.");
  if (!ALLOWED_MIME.has(file.type)) {
    throw new AppError("VALIDATION", `Typ ${file.type} není povolený.`);
  }
  if (meta.data.parentType === "CARD") {
    const card = await loadCardForRBAC(meta.data.parentId);
    if (!canEditCard(user, card)) throw new AppError("FORBIDDEN", "Nemůžeš nahrávat přílohy k této kartě.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Server-side MIME sniffing — neslepě věřit klientskému `file.type`.
  const sniffed = await fileTypeFromBuffer(buffer);
  let verifiedMime: string;
  if (sniffed) {
    if (sniffed.mime === CFB_MIME && CFB_DECLARED_MIME.has(file.type)) {
      // Legacy Office (CFB) — sniffer nerozliší, věříme deklaraci z allow-listu.
      verifiedMime = file.type;
    } else if (!ALLOWED_MIME.has(sniffed.mime)) {
      throw new AppError("VALIDATION", `Detekovaný typ ${sniffed.mime} není povolený.`);
    } else {
      verifiedMime = sniffed.mime;
    }
  } else if (SNIFF_BYPASS_MIME.has(file.type)) {
    verifiedMime = file.type;
  } else {
    throw new AppError("VALIDATION", "Nepodařilo se ověřit typ souboru.");
  }

  const db = getPrismaAudited(user.id);
  const created = await db.attachment.create({
    data: {
      parentType: meta.data.parentType,
      parentId: meta.data.parentId,
      fileName: file.name,
      data: buffer, // BLOB v DB (projekty_attachment.data LONGBLOB)
      size: buffer.length,
      mime: verifiedMime,
      uploadedBy: user.id,
    },
    // NEvracet `data` (BLOB) v odpovědi — jen metadata.
    select: {
      id: true,
      parentType: true,
      parentId: true,
      fileName: true,
      size: true,
      mime: true,
      uploadedBy: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ attachment: created }, { status: 201 });
});

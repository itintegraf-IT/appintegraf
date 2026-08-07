import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { ensureProductThumbnailFromPdf } from "@/lib/iml-product-thumbnail";
import {
  deleteArchiveFileIfExists,
  resolveProductPdfBuffer,
} from "@/lib/iml-product-archive";

/**
 * Verzovaný PDF endpoint pro iml_product_files.
 *
 * Chování:
 * - GET          → vrátí aktuální primary verzi PDF (BLOB nebo archiv na disku).
 * - GET ?version → vrátí konkrétní historickou verzi.
 * - POST         → nahraje nové PDF jako novou verzi (max(version)+1),
 *                  dřívější primary se vypne. U archivovaného produktu zruší archived_at.
 * - DELETE       → smaže aktuální primary verzi. Pokud existuje předchozí
 *                  verze (s nejvyšším version), stane se novou primary.
 *
 * Fallback: pokud produkt nemá žádnou verzi v iml_product_files,
 * čte se legacy `iml_products.pdf_data` / `pdf_archive_path`.
 */
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50 MB (spec 3.4)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Neautorizováno", { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return new NextResponse("Nemáte oprávnění", { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return new NextResponse("Neplatné ID", { status: 400 });
  }

  const versionParam = req.nextUrl.searchParams.get("version");
  const versionNum =
    versionParam && /^\d+$/.test(versionParam) ? parseInt(versionParam, 10) : null;

  const resolved = await resolveProductPdfBuffer(id, { version: versionNum });
  if (!resolved) {
    return new NextResponse("PDF nenalezeno", { status: 404 });
  }

  return new NextResponse(new Uint8Array(resolved.buffer), {
    headers: {
      "Content-Type": resolved.mimeType || "application/pdf",
      "Content-Disposition": `inline; filename="${sanitizeFilename(resolved.filename)}"`,
      "Cache-Control": "private, max-age=3600",
      "X-PDF-Version": String(resolved.version),
      "X-PDF-Source": resolved.source,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.iml_products.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Produkt nenalezen" }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Nebyl nahrán žádný soubor" }, { status: 400 });
    }

    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json(
        { error: `PDF je příliš velké (max ${Math.round(MAX_PDF_SIZE / 1024 / 1024)} MB)` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Magic bytes: PDF začíná "%PDF-" (25 50 44 46 2D). Tohle je zdroj pravdy;
    // MIME typ různé prohlížeče/OS často hlásí špatně (např. application/octet-stream).
    if (
      buffer.length < 5 ||
      buffer[0] !== 0x25 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x44 ||
      buffer[3] !== 0x46 ||
      buffer[4] !== 0x2d
    ) {
      return NextResponse.json(
        { error: "Soubor nevypadá jako platné PDF (chybná hlavička)" },
        { status: 400 }
      );
    }

    const filename = sanitizeFilename(file.name || "tiskova-data.pdf");

    const result = await prisma.$transaction(async (tx) => {
      const latest = await tx.iml_product_files.aggregate({
        where: { product_id: id },
        _max: { version: true },
      });
      const nextVersion = (latest._max.version ?? 0) + 1;

      // Všechny stávající označit is_primary=false.
      await tx.iml_product_files.updateMany({
        where: { product_id: id, is_primary: true },
        data: { is_primary: false },
      });

      const created = await tx.iml_product_files.create({
        data: {
          product_id: id,
          version: nextVersion,
          filename,
          file_size: buffer.length,
          mime_type: "application/pdf",
          pdf_data: buffer,
          is_primary: true,
          uploaded_by: userId,
          last_accessed_at: new Date(),
        },
        select: {
          id: true,
          version: true,
          filename: true,
          file_size: true,
          mime_type: true,
          is_primary: true,
          uploaded_by: true,
          uploaded_at: true,
        },
      });

      // Nový upload = produkt je znovu „hot“ (zruš archivní příznak).
      if (existing.archived_at) {
        await tx.iml_products.update({
          where: { id },
          data: { archived_at: null, is_active: true },
        });
      }

      return created;
    });

    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_product_files",
      recordId: result.id,
      newValues: {
        product_id: id,
        version: result.version,
        filename: result.filename,
        file_size: result.file_size,
      },
    });

    try {
      await ensureProductThumbnailFromPdf(id, buffer, userId, { onlyIfMissing: true });
    } catch (thumbErr) {
      console.warn("IML product PDF thumbnail generation failed:", thumbErr);
    }

    return NextResponse.json({ success: true, file: result });
  } catch (e) {
    const err = e as Error & { code?: string; meta?: { code?: string } };
    const msg = String(err.message ?? "");
    console.error(
      "IML product PDF upload error:",
      msg,
      "code:",
      err.code ?? err.meta?.code
    );

    // MySQL: příliš velký paket vůči max_allowed_packet (typicky na serveru nižší než lokálně).
    if (
      /packet too large|max_allowed_packet|got a packet bigger than|ER_NET_PACKET_TOO_LARGE/i.test(
        msg
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Databáze odmítla soubor (příliš velký paket). Na serveru MySQL/MariaDB zvyšte `max_allowed_packet` (např. 64M) a restartujte DB. Alternativně zmenšete PDF.",
          detail: "mysql_max_allowed_packet",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: "Chyba při nahrávání PDF",
        detail: process.env.NODE_ENV === "development" ? msg.slice(0, 200) : undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const primary = await tx.iml_product_files.findFirst({
        where: { product_id: id, is_primary: true },
        orderBy: { version: "desc" },
      });

      if (primary) {
        const archivePath = primary.archive_path;
        await tx.iml_product_files.delete({ where: { id: primary.id } });

        // Po smazání primary povýšíme nejnovější zbývající verzi.
        const next = await tx.iml_product_files.findFirst({
          where: { product_id: id },
          orderBy: { version: "desc" },
        });
        if (next) {
          await tx.iml_product_files.update({
            where: { id: next.id },
            data: { is_primary: true },
          });
        }
        return {
          deleted_version: primary.version,
          promoted_version: next?.version ?? null,
          archive_path: archivePath,
        };
      }

      // Jinak zkus legacy sloupec / archiv.
      const legacy = await tx.iml_products.findUnique({
        where: { id },
        select: { pdf_data: true, pdf_archive_path: true },
      });
      if (
        (legacy?.pdf_data && legacy.pdf_data.length > 0) ||
        legacy?.pdf_archive_path
      ) {
        const archivePath = legacy.pdf_archive_path;
        await tx.iml_products.update({
          where: { id },
          data: { pdf_data: null, pdf_archive_path: null },
        });
        return {
          deleted_version: "legacy" as const,
          promoted_version: null as number | null,
          archive_path: archivePath,
        };
      }
      return null;
    });

    if (!result) {
      return NextResponse.json({ error: "Žádné PDF k odstranění" }, { status: 404 });
    }

    await deleteArchiveFileIfExists(result.archive_path);

    await logImlAudit({
      userId,
      action: "delete",
      tableName: "iml_product_files",
      recordId: id,
      oldValues: { deleted_version: result.deleted_version },
      newValues: { promoted_version: result.promoted_version },
    });

    return NextResponse.json({
      success: true,
      deleted_version: result.deleted_version,
      promoted_version: result.promoted_version,
    });
  } catch (e) {
    console.error("IML product PDF delete error:", e);
    return NextResponse.json({ error: "Chyba při mazání PDF" }, { status: 500 });
  }
}

/**
 * Bezpečné filename – bez cesty, max 255 znaků, jen ASCII alfanumerika
 * + pár povolených znaků. Prohlížeče akceptují v Content-Disposition různé věci,
 * ale chceme minimum pro konzistentní uložení i stažení.
 */
function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "tiskova-data.pdf";
  const cleaned = base
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
  return cleaned || "tiskova-data.pdf";
}

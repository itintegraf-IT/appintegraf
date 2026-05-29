import { unlink } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const IML_CUSTOMER_UPLOAD_MODULE = "iml_customers";
export const IML_CUSTOMER_MAX_BYTES = 20 * 1024 * 1024;

export const IML_CUSTOMER_ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const IML_CUSTOMER_UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "iml-customers"
);

export function imlCustomerUploadWebPath(safeName: string): string {
  return `/uploads/iml-customers/${safeName}`;
}

export function imlCustomerUploadDiskPath(safeName: string): string {
  return path.join(IML_CUSTOMER_UPLOAD_DIR, safeName);
}

export function diskPathFromWebPath(webPath: string): string {
  const normalized = webPath.replace(/^\//, "");
  return path.join(process.cwd(), "public", normalized);
}

/** Smaže všechny přílohy zákazníka z DB i disku. */
export async function deleteAllCustomerUploads(
  customerId: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  const rows = await db.file_uploads.findMany({
    where: { module: IML_CUSTOMER_UPLOAD_MODULE, record_id: customerId },
    select: { id: true, file_path: true },
  });

  for (const row of rows) {
    try {
      await unlink(diskPathFromWebPath(row.file_path));
    } catch {
      // soubor už chybí na disku
    }
  }

  await db.file_uploads.deleteMany({
    where: { module: IML_CUSTOMER_UPLOAD_MODULE, record_id: customerId },
  });
}

import { prisma } from "@/lib/db";
import { MATERIALY_UPLOAD_MODULE } from "@/lib/materialy/upload";

export type MaterialFileSummary = {
  id: number;
  original_filename: string;
  file_path: string;
  mime_type: string;
  document_type: string | null;
};

export type MaterialFilesByRecord = {
  sds: MaterialFileSummary | null;
  certificate: MaterialFileSummary | null;
};

/** Nejnovější SDS a certifikát pro každý materiál (pro seznam v katalogu). */
export async function loadMaterialFileSummaries(
  materialIds: number[]
): Promise<Map<number, MaterialFilesByRecord>> {
  const map = new Map<number, MaterialFilesByRecord>();
  if (materialIds.length === 0) return map;

  const rows = await prisma.file_uploads.findMany({
    where: {
      module: MATERIALY_UPLOAD_MODULE,
      record_id: { in: materialIds },
      document_type: { in: ["SDS", "CERTIFICATE"] },
    },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      record_id: true,
      original_filename: true,
      file_path: true,
      mime_type: true,
      document_type: true,
    },
  });

  for (const id of materialIds) {
    map.set(id, { sds: null, certificate: null });
  }

  for (const row of rows) {
    const rid = row.record_id;
    if (rid == null) continue;
    const bucket = map.get(rid);
    if (!bucket) continue;
    const summary: MaterialFileSummary = {
      id: row.id,
      original_filename: row.original_filename,
      file_path: row.file_path,
      mime_type: row.mime_type,
      document_type: row.document_type,
    };
    if (row.document_type === "SDS" && !bucket.sds) bucket.sds = summary;
    if (row.document_type === "CERTIFICATE" && !bucket.certificate) bucket.certificate = summary;
  }

  return map;
}

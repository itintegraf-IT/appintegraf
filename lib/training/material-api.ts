import type { MaterialType } from "@/lib/training/material-types";
import { TRAINING_MATERIAL_UPLOAD_MODULE } from "@/lib/training/material-upload";
import { prisma } from "@/lib/db";

export type MaterialFileMeta = {
  id: number;
  original_filename: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  serve_url: string;
};

export function getMaterialFileServeUrl(materialId: number): string {
  return `/api/training/materials/${materialId}/file`;
}

export async function getMaterialFiles(
  materialIds: number[]
): Promise<Map<number, MaterialFileMeta>> {
  if (materialIds.length === 0) return new Map();

  const rows = await prisma.file_uploads.findMany({
    where: {
      module: TRAINING_MATERIAL_UPLOAD_MODULE,
      record_id: { in: materialIds },
    },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      record_id: true,
      original_filename: true,
      file_path: true,
      mime_type: true,
      file_size: true,
    },
  });

  const map = new Map<number, MaterialFileMeta>();
  for (const row of rows) {
    if (row.record_id != null && !map.has(row.record_id)) {
      map.set(row.record_id, {
        id: row.id,
        original_filename: row.original_filename,
        file_path: row.file_path,
        mime_type: row.mime_type,
        file_size: row.file_size,
        serve_url: getMaterialFileServeUrl(row.record_id),
      });
    }
  }
  return map;
}

export async function getMaterialFile(materialId: number): Promise<MaterialFileMeta | null> {
  const map = await getMaterialFiles([materialId]);
  return map.get(materialId) ?? null;
}

export type MaterialPayload = {
  title?: string;
  content?: string;
  source?: string | null;
  category_id?: number | null;
  material_type?: MaterialType;
  media_url?: string | null;
};

export function normalizeMediaUrl(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const trimmed = String(raw).trim();
  return trimmed || null;
}

export function validateMaterialPayload(
  payload: MaterialPayload,
  options: { isCreate: boolean; hasFile?: boolean }
): { ok: true; data: Required<Pick<MaterialPayload, "title">> & MaterialPayload } | { ok: false; error: string } {
  const title = payload.title !== undefined ? String(payload.title).trim() : undefined;
  const content = payload.content !== undefined ? String(payload.content).trim() : undefined;
  const materialType = payload.material_type ?? "text";
  const mediaUrl = normalizeMediaUrl(payload.media_url);

  if (options.isCreate) {
    if (!title) return { ok: false, error: "Vyplňte název materiálu" };
  } else if (title !== undefined && !title) {
    return { ok: false, error: "Název nesmí být prázdný" };
  }

  if (materialType === "text") {
    const effectiveContent = content ?? (options.isCreate ? "" : undefined);
    if (options.isCreate && !effectiveContent) {
      return { ok: false, error: "Vyplňte obsah textového materiálu" };
    }
    if (effectiveContent !== undefined && !effectiveContent) {
      return { ok: false, error: "Obsah nesmí být prázdný" };
    }
  }

  if (materialType === "video" && options.isCreate) {
    if (!mediaUrl && !options.hasFile) {
      return { ok: false, error: "U videa nahrajte soubor nebo volitelně zadejte externí URL" };
    }
  }

  if (materialType === "presentation" && options.isCreate) {
    if (!options.hasFile) {
      return { ok: false, error: "U prezentace nahrajte soubor PDF nebo PPTX" };
    }
  }

  if (materialType === "video" && !options.isCreate && !mediaUrl && !options.hasFile) {
    return { ok: false, error: "U videa nahrajte soubor nebo volitelně zadejte externí URL" };
  }
  if (mediaUrl && materialType === "video") {
    try {
      new URL(mediaUrl);
    } catch {
      return { ok: false, error: "Neplatná URL videa" };
    }
  }

  return {
    ok: true,
    data: {
      title: title as string,
      content,
      source: payload.source,
      category_id: payload.category_id,
      material_type: materialType,
      media_url: materialType === "video" ? mediaUrl ?? null : null,
    },
  };
}

export function serializeMaterial(
  material: {
    id: number;
    title: string;
    content: string;
    source: string | null;
    category_id: number | null;
    material_type: string;
    media_url: string | null;
    question_categories: {
      id: number;
      name: string;
      code: string;
      color: string | null;
    } | null;
  },
  file: MaterialFileMeta | null
) {
  return {
    ...material,
    file,
  };
}

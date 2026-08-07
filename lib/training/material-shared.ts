/** Sdílené typy a helpery bez serverových závislostí (bezpečné pro client komponenty). */

export type MaterialFileMeta = {
  id: number;
  original_filename: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  serve_url: string;
};

export function getMaterialFileServeUrl(materialId: number, download = false): string {
  const base = `/api/training/materials/${materialId}/file`;
  return download ? `${base}?download=1` : base;
}

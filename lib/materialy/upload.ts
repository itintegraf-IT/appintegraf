export const MATERIALY_UPLOAD_MODULE = "materialy";
export const MATERIALY_MAX_BYTES = 20 * 1024 * 1024;

export const MATERIALY_ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

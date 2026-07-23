export const EQUIPMENT_UPLOAD_MODULE = "equipment";
export const EQUIPMENT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const EQUIPMENT_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

export const EQUIPMENT_PHOTO_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const EQUIPMENT_ATTACHMENT_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const EQUIPMENT_DOC_TYPES = new Set([
  "photo",
  "photo_cover",
  "attachment",
  "invoice",
  "delivery_note",
  "warranty",
  "service",
  "other",
]);

export type EquipmentAttachmentDocType =
  | "invoice"
  | "delivery_note"
  | "warranty"
  | "service"
  | "attachment"
  | "other";

export const EQUIPMENT_ATTACHMENT_DOC_TYPES: {
  value: EquipmentAttachmentDocType;
  label: string;
}[] = [
  { value: "invoice", label: "Faktura (FA)" },
  { value: "delivery_note", label: "Dodací list" },
  { value: "warranty", label: "Záruční list" },
  { value: "service", label: "Servisní protokol" },
  { value: "attachment", label: "Obecná příloha" },
  { value: "other", label: "Jiný dokument" },
];

export function equipmentAttachmentTypeLabel(type: string | null | undefined): string {
  return (
    EQUIPMENT_ATTACHMENT_DOC_TYPES.find((t) => t.value === type)?.label ??
    (type ? type : "Dokument")
  );
}

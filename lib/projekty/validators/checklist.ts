import { z } from "zod";

export const ChecklistCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const ChecklistUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
});

export const ChecklistItemCreateSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export const ChecklistItemUpdateSchema = z.object({
  text: z.string().trim().min(1).max(500).optional(),
  done: z.boolean().optional(),
  assigneeId: z.coerce.number().int().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const ChecklistItemMoveSchema = z.object({
  afterItemId: z.string().cuid().optional(),
  beforeItemId: z.string().cuid().optional(),
}).refine((d) => d.afterItemId || d.beforeItemId, {
  message: "Musíš poslat afterItemId nebo beforeItemId.",
});

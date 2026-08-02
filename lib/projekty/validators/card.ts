import { z } from "zod";
import { CARD_PRIORITIES } from "@/lib/projekty/priority";

export const CardCreateSchema = z.object({
  title: z.string().trim().min(1, "Název karty je povinný.").max(500),
});

export const CardUpdateSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(50000).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  completed: z.boolean().optional(),
  cover: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  archived: z.boolean().optional(),
  // null = odebrat prioritu (výchozí stav karty), undefined = neměnit.
  priority: z.enum(CARD_PRIORITIES).optional().nullable(),
});

export const CardMoveSchema = z.object({
  listId: z.string().cuid(),
  afterCardId: z.string().cuid().optional(),
  beforeCardId: z.string().cuid().optional(),
});

export const CardMemberAddSchema = z.object({
  userId: z.coerce.number().int(),
});

export const CardLabelToggleSchema = z.object({
  labelId: z.string().cuid(),
});

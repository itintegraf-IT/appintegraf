import { z } from "zod";

export const BoardCreateSchema = z.object({
  name: z.string().trim().min(1, "Název je povinný.").max(100),
  description: z.string().max(2000).optional().nullable(),
  background: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Background musí být hex barva.")
    .optional()
    .nullable(),
});

export const BoardUpdateSchema = BoardCreateSchema.partial().extend({
  archived: z.boolean().optional(),
});

export type BoardCreateInput = z.infer<typeof BoardCreateSchema>;
export type BoardUpdateInput = z.infer<typeof BoardUpdateSchema>;

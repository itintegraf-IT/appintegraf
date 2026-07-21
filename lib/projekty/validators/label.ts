import { z } from "zod";

export const LabelCreateSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color musí být hex barva."),
});

export const LabelUpdateSchema = LabelCreateSchema.partial();

import { z } from "zod";

const hexColor = /^#[0-9A-Fa-f]{6}$/;

export const DealCategoryCreateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  label: z.string().trim().min(1).max(200),
  color: z.string().regex(hexColor, "Barva musí být ve formátu #RRGGBB"),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  active: z.boolean().optional().default(true),
});

export const DealCategoryUpdateSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  color: z.string().regex(hexColor, "Barva musí být ve formátu #RRGGBB").optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
});

export type DealCategoryCreateInput = z.infer<typeof DealCategoryCreateSchema>;
export type DealCategoryUpdateInput = z.infer<typeof DealCategoryUpdateSchema>;

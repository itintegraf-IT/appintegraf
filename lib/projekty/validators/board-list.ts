import { z } from "zod";
import { LIST_COLOR_VALUES } from "@/lib/projekty/list-colors";

const ColorSchema = z
  .enum(LIST_COLOR_VALUES as [string, ...string[]], {
    errorMap: () => ({ message: "Color musí být jedna z preset hodnot." }),
  })
  .optional()
  .nullable();

export const ListCreateSchema = z.object({
  name: z.string().trim().min(1, "Název listu je povinný.").max(100),
  color: ColorSchema,
});

export const ListUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  color: ColorSchema,
  archived: z.boolean().optional(),
});

export const ListMoveSchema = z
  .object({
    afterListId: z.string().cuid().optional(),
    beforeListId: z.string().cuid().optional(),
  })
  .refine((d) => d.afterListId || d.beforeListId, {
    message: "Musíš poslat afterListId nebo beforeListId.",
  });

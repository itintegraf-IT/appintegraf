import { z } from "zod";

export const NoteCreateSchema = z.object({
  parentType: z.enum(["CARD"]),
  parentId: z.string().cuid(),
  content: z.string().min(1).max(10_000),
});

export const NoteUpdateSchema = z.object({
  content: z.string().min(1).max(10_000),
});

export type NoteCreateInput = z.infer<typeof NoteCreateSchema>;

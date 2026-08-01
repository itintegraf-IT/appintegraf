import { z } from "zod";

const cardIds = z.array(z.string().cuid()).min(1).max(100);

export const BulkUpdateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("move"),
    cardIds,
    payload: z.object({ listId: z.string().cuid() }),
  }),
  z.object({
    action: z.literal("addLabel"),
    cardIds,
    payload: z.object({ labelIds: z.array(z.string().cuid()).min(1) }),
  }),
  z.object({
    action: z.literal("addMember"),
    cardIds,
    payload: z.object({ userIds: z.array(z.coerce.number().int()).min(1) }),
  }),
  z.object({
    action: z.literal("archive"),
    cardIds,
    payload: z.object({ archived: z.boolean() }),
  }),
]);

export type BulkUpdateInput = z.infer<typeof BulkUpdateSchema>;

export const BulkDeleteSchema = z.object({ cardIds });
export type BulkDeleteInput = z.infer<typeof BulkDeleteSchema>;

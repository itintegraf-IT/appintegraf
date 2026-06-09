import { z } from "zod";

export const ACTIVITY_TYPES = ["CALL", "MEETING", "EMAIL", "REMINDER", "NOTE"] as const;
export const PARENT_TYPES = ["COMPANY", "CONTACT", "DEAL"] as const;

export const ActivityCreateSchema = z.object({
  parent_type: z.enum(PARENT_TYPES),
  parent_id: z.string().cuid(),
  type: z.enum(ACTIVITY_TYPES),
  date: z.string().datetime(),
  duration: z.number().int().positive().optional().nullable(),
  note: z.string().max(10_000).optional().nullable(),
  outcome: z.string().max(2_000).optional().nullable(),
  next_action_date: z.string().datetime().optional().nullable(),
  assignee_id: z.number().int().optional().nullable(),
});

export const ActivityUpdateSchema = ActivityCreateSchema.partial().omit({
  parent_type: true,
  parent_id: true,
}).extend({
  completed_at: z.string().datetime().nullable().optional(),
});

export type ActivityCreateInput = z.infer<typeof ActivityCreateSchema>;
export type ActivityUpdateInput = z.infer<typeof ActivityUpdateSchema>;

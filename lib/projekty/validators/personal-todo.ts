import { z } from "zod";

export const PersonalTodoStatusEnum = z.enum(["NOT_STARTED", "IN_PROGRESS", "DONE"]);
export type PersonalTodoStatusValue = z.infer<typeof PersonalTodoStatusEnum>;

export const CreatePersonalTodoSchema = z.object({
  title: z.string().min(1, "Název je povinný.").max(500),
  description: z.string().max(5000).optional(),
  dueDate: z.string().datetime().optional(),
});
export type CreatePersonalTodoInput = z.infer<typeof CreatePersonalTodoSchema>;

export const UpdatePersonalTodoSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(5000).nullable().optional(),
    status: PersonalTodoStatusEnum.optional(),
    dueDate: z.string().datetime().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Žádné změny." });
export type UpdatePersonalTodoInput = z.infer<typeof UpdatePersonalTodoSchema>;

export const PromotePersonalTodoSchema = z.object({
  boardId: z.string().cuid(),
  listId: z.string().cuid(),
});
export type PromotePersonalTodoInput = z.infer<typeof PromotePersonalTodoSchema>;

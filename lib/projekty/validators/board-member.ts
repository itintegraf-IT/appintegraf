import { z } from "zod";

export const BoardMemberAddSchema = z.object({
  userId: z.coerce.number().int(),
  role: z.enum(["ADMIN", "MEMBER", "OBSERVER"]).default("MEMBER"),
});

export const BoardMemberUpdateSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "OBSERVER"]),
});

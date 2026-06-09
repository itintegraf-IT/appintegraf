import { z } from "zod";

export const ContactCreateSchema = z.object({
  company_id: z.string().cuid("Neplatný company_id"),
  first_name: z.string().min(1, "Jméno je povinné").max(100),
  last_name: z.string().min(1, "Příjmení je povinné").max(100),
  role: z.string().max(100).optional().or(z.literal("")),
  email: z.string().email("Neplatný e-mail").optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  is_decision_maker: z.boolean().optional(),
});

export const ContactUpdateSchema = ContactCreateSchema.partial();

export const ContactListQuerySchema = z.object({
  q: z.string().optional(),
  company_id: z.string().cuid().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
  page: z.coerce.number().int().min(1).default(1),
  sortBy: z.enum(["first_name", "last_name", "role", "email", "phone"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export type ContactCreateInput = z.infer<typeof ContactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof ContactUpdateSchema>;

import { z } from "zod";

const icoRegex = /^\d{8}$/;

export const CompanyCreateSchema = z.object({
  name: z.string().min(1, "Název je povinný").max(200),
  ico: z.string().regex(icoRegex, "IČO musí mít 8 číslic").optional().or(z.literal("")),
  dic: z.string().max(20).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  segment: z.string().max(100).optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
  owner_id: z.coerce.number().int().optional().nullable(),
});

export const CompanyUpdateSchema = CompanyCreateSchema.partial();

export const CompanyListQuerySchema = z.object({
  q: z.string().optional(),
  owner_id: z.coerce.number().int().optional(),
  segment: z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
  page: z.coerce.number().int().min(1).default(1),
  sortBy: z.enum(["name", "ico", "segment", "updated_at"]).optional().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export type CompanyCreateInput = z.infer<typeof CompanyCreateSchema>;
export type CompanyUpdateInput = z.infer<typeof CompanyUpdateSchema>;

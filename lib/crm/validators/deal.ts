import { z } from "zod";
import { crm_deal_stage } from "@prisma/client";

export const DealCreateSchema = z.object({
  company_id: z.string().cuid(),
  title: z.string().min(1).max(200),
  value: z.coerce.number().min(0),
  stage: z.nativeEnum(crm_deal_stage).default("LEAD"),
  probability: z.coerce.number().int().min(0).max(100).default(10),
  close_date: z.string().datetime().optional().or(z.literal("")),
  owner_id: z.number().int().optional(),
  contactIds: z.array(z.string().cuid()).optional(),
  lost_reason: z.string().optional().or(z.literal("")),
  category_id: z.string().cuid().nullable().optional(),
});

export const DealUpdateSchema = DealCreateSchema.partial();

export const DealStageUpdateSchema = z.object({
  stage: z.nativeEnum(crm_deal_stage),
  lost_reason: z.string().optional(),
});

export const DealListQuerySchema = z.object({
  q: z.string().optional(),
  stage: z.nativeEnum(crm_deal_stage).optional(),
  owner_id: z.number().int().optional(),
  company_id: z.string().cuid().optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
  skip: z.coerce.number().int().min(0).default(0),
  page: z.coerce.number().int().min(1).default(1),
  sortBy: z.enum(["title", "stage", "value", "probability", "updated_at"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

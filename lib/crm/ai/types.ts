import { z } from "zod";

export const DealSummaryContentSchema = z.object({
  factStrip: z.string().min(1).max(300),
  clientInfo: z.array(z.string().min(1).max(300)).max(10),
  topics: z.array(z.string().min(1).max(300)).max(10),
  history: z
    .array(
      z.object({
        date: z.string().min(1).max(20),
        description: z.string().min(1).max(300),
      })
    )
    .max(50),
  upcoming: z
    .array(
      z.object({
        date: z.string().min(1).max(20),
        description: z.string().min(1).max(300),
      })
    )
    .max(20),
  conclusion: z.string().min(1).max(1500),
  nextActions: z.array(z.string().min(1).max(300)).max(10),
});

export type DealSummaryContent = z.infer<typeof DealSummaryContentSchema>;

export type CachedDealSummary = {
  id: string;
  content: DealSummaryContent;
  model: string;
  tokens: number;
  createdAt: string;
  isStale: boolean;
};

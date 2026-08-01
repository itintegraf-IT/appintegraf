import { z } from "zod";

export const CardSearchSchema = z.object({
  q: z.string().trim().min(1, "Zadej hledaný text.").max(200),
});

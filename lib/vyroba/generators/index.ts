import { createVnitro } from "./createVnitro";
import { createPOP } from "./createPOP";
import { createNEXGO } from "./createNEXGO";
import { createDPB_AVJ } from "./createDPB_AVJ";
import { createIGT_Sazka } from "./createIGT_Sazka";
import type { VarConfig } from "./types";
import type { GenerateResult } from "./types";

export type JobType =
  | "CD_POP"
  | "CD_POP_NEXGO"
  | "CD_Vnitro"
  | "CD_Validator"
  | "DPB_AVJ"
  | "IGT_Sazka";

export function generate(
  adresa: string,
  job: JobType,
  varConfig: VarConfig,
  input: number,
  options?: { cislovaniVypnuto?: boolean }
): GenerateResult {
  switch (job) {
    case "CD_Vnitro":
    case "CD_Validator":
      return createVnitro(
        adresa,
        job,
        varConfig,
        input,
        options?.cislovaniVypnuto ?? false
      );
    case "CD_POP":
      return createPOP(adresa, job, varConfig, input);
    case "CD_POP_NEXGO":
      return createNEXGO(adresa, job, varConfig, input);
    case "DPB_AVJ":
      return createDPB_AVJ(adresa, job, varConfig, input);
    case "IGT_Sazka":
      return createIGT_Sazka(adresa, job, varConfig, input);
    default:
      return { success: false, error: "Neznámý typ JOB: " + job };
  }
}

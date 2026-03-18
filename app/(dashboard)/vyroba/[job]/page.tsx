import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { JOB_TYPES } from "@/lib/vyroba/config/fix-settings";
import ParametryClient from "./ParametryClient";
import { prisma } from "@/lib/db";

type Props = {
  params: Promise<{ job: string }>;
};

export default async function VyrobaJobPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const canRead = await hasModuleAccess(userId, "vyroba", "read");
  const canWrite = await hasModuleAccess(userId, "vyroba", "write");

  if (!canRead) redirect("/");

  const { job } = await params;
  if (!JOB_TYPES.includes(job as (typeof JOB_TYPES)[number])) {
    redirect("/vyroba");
  }

  const [addressSetting, jobConfig] = await Promise.all([
    prisma.vyroba_settings.findUnique({ where: { setting_key: "ADRESA" } }),
    prisma.vyroba_job_config.findUnique({ where: { job } }),
  ]);

  const address = addressSetting?.setting_val ?? process.env.VYROBA_OUTPUT_PATH ?? "";
  const config = jobConfig
    ? {
        serie: (jobConfig.serie as string[]) ?? ["XB", "XC", "XD", "XE", "XF", "XG"],
        pocetCnaRoli: jobConfig.pocet_cna_roli,
        ksVKr: jobConfig.ks_v_krabici,
        prvniRole: jobConfig.prvni_role,
        prvniJizd: jobConfig.prvni_jizd,
        prod: jobConfig.prod,
        skip: jobConfig.skip,
        predcisli: jobConfig.predcisli as string[] | null,
        cisloZakazky: jobConfig.cislo_zakazky,
      }
    : null;

  return (
    <ParametryClient
      job={job}
      canWrite={canWrite}
      initialAddress={address}
      initialConfig={config}
    />
  );
}

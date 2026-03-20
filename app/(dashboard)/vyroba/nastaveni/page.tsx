import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import VyrobaNastaveniClient from "./VyrobaNastaveniClient";

type JobConfigRow = Awaited<ReturnType<typeof prisma.vyroba_job_config.findMany>>[number];

export default async function VyrobaNastaveniPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "vyroba", "write"))) {
    redirect("/vyroba");
  }

  const [addressSetting, jobConfigs, employees] = await Promise.all([
    prisma.vyroba_settings.findUnique({
      where: { setting_key: "ADRESA" },
    }),
    prisma.vyroba_job_config.findMany(),
    prisma.vyroba_employees.findMany({
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    }),
  ]);

  const address = addressSetting?.setting_val ?? process.env.VYROBA_OUTPUT_PATH ?? "";
  const configMap = Object.fromEntries(
    jobConfigs.map((c: JobConfigRow) => [c.job, c])
  );

  return (
    <VyrobaNastaveniClient
      initialAddress={address}
      initialJobConfigs={configMap}
      initialEmployees={employees}
    />
  );
}

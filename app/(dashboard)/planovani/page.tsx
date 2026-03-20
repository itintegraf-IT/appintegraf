import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPlanovaniRole } from "@/lib/planovani-auth";
import { hasPlanovaniAccess } from "@/lib/planovani-auth";
import PlannerPage from "./_components/PlannerPage";
import type { Block, CompanyDay } from "./_components/TimelineGrid";

export default async function PlanovaniPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasPlanovaniAccess(userId))) redirect("/");

  const [blocks, companyDays, role] = await Promise.all([
    prisma.planovani_blocks.findMany({ orderBy: { startTime: "asc" } }),
    prisma.planovani_company_days.findMany({ orderBy: { startDate: "asc" } }),
    getPlanovaniRole(userId),
  ]);

  type BlockRow = { startTime: Date; endTime: Date; deadlineExpedice?: Date | null; dataRequiredDate?: Date | null; materialRequiredDate?: Date | null; createdAt: Date; updatedAt: Date } & Record<string, unknown>;
  const serialized = blocks.map((b: BlockRow) => ({
    ...b,
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString(),
    deadlineExpedice: b.deadlineExpedice?.toISOString() ?? null,
    dataRequiredDate: b.dataRequiredDate?.toISOString() ?? null,
    materialRequiredDate: b.materialRequiredDate?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }));

  type CompanyDayRow = { startDate: Date; endDate: Date; createdAt: Date } & Record<string, unknown>;
  const serializedCompanyDays = companyDays.map((d: CompanyDayRow) => ({
    ...d,
    startDate: d.startDate.toISOString(),
    endDate: d.endDate.toISOString(),
    createdAt: d.createdAt.toISOString(),
  }));

  const currentUser = {
    id: userId,
    username: (session.user as { username?: string }).username ?? session.user.name ?? session.user.email ?? "uživatel",
    role,
  };

  return (
    <PlannerPage
      initialBlocks={serialized as Block[]}
      initialCompanyDays={serializedCompanyDays as CompanyDay[]}
      currentUser={currentUser}
    />
  );
}

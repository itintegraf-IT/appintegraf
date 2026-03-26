import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  getPlanovaniAssignedMachine,
  getPlanovaniRole,
  hasPlanovaniAccess,
} from "@/lib/planovani-auth";
import PlannerPage from "./_components/PlannerPage";
import type { Block, CompanyDay } from "./_components/TimelineGrid";
import type { MachineWorkHours } from "@/lib/machineWorkHours";
import type { MachineScheduleException } from "@/lib/machineScheduleException";

export default async function PlanovaniPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasPlanovaniAccess(userId))) redirect("/");

  const role = await getPlanovaniRole(userId);
  if (role === "TISKAR") {
    redirect("/planovani/tiskar");
  }

  const [blocks, companyDays, machineWorkHours, machineExceptions, assignedMachine] = await Promise.all([
    prisma.planovani_blocks.findMany({ orderBy: { startTime: "asc" } }),
    prisma.planovani_company_days.findMany({ orderBy: { startDate: "asc" } }),
    prisma.planovani_machine_work_hours.findMany({
      orderBy: [{ machine: "asc" }, { dayOfWeek: "asc" }],
    }),
    prisma.planovani_machine_schedule_exceptions.findMany({
      orderBy: [{ date: "asc" }, { machine: "asc" }],
    }),
    getPlanovaniAssignedMachine(userId),
  ]);

  type BlockRow = {
    startTime: Date;
    endTime: Date;
    deadlineExpedice?: Date | null;
    dataRequiredDate?: Date | null;
    materialRequiredDate?: Date | null;
    printCompletedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } & Record<string, unknown>;

  const serialized = blocks.map((b: BlockRow) => ({
    ...b,
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString(),
    deadlineExpedice: b.deadlineExpedice?.toISOString() ?? null,
    dataRequiredDate: b.dataRequiredDate?.toISOString() ?? null,
    materialRequiredDate: b.materialRequiredDate?.toISOString() ?? null,
    printCompletedAt: b.printCompletedAt?.toISOString() ?? null,
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

  const serializedExceptions: MachineScheduleException[] = machineExceptions.map((e) => ({
    id: e.id,
    machine: e.machine,
    date: e.date.toISOString(),
    startHour: e.startHour,
    endHour: e.endHour,
    isActive: e.isActive,
    label: e.label,
  }));

  const currentUser = {
    id: userId,
    username:
      (session.user as { username?: string }).username ??
      session.user.name ??
      session.user.email ??
      "uživatel",
    role,
    assignedMachine: assignedMachine ?? null,
  };

  return (
    <PlannerPage
      initialBlocks={serialized as Block[]}
      initialCompanyDays={serializedCompanyDays as CompanyDay[]}
      initialMachineWorkHours={machineWorkHours as MachineWorkHours[]}
      initialMachineExceptions={serializedExceptions}
      currentUser={currentUser}
    />
  );
}

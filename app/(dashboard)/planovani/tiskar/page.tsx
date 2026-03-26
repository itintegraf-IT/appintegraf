import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  getPlanovaniAssignedMachine,
  getPlanovaniRole,
  hasPlanovaniAccess,
} from "@/lib/planovani-auth";
import { startOfDay, addDays } from "date-fns";
import TiskarMonitor from "./_components/TiskarMonitor";

export default async function PlanovaniTiskarPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasPlanovaniAccess(userId))) redirect("/");

  const role = await getPlanovaniRole(userId);
  if (role !== "TISKAR") {
    redirect("/planovani");
  }

  const assignedMachine = await getPlanovaniAssignedMachine(userId);
  if (!assignedMachine) {
    redirect("/");
  }

  const viewStart = startOfDay(new Date());
  const viewEnd = addDays(viewStart, 7);

  const blocks = await prisma.planovani_blocks.findMany({
    where: {
      machine: assignedMachine,
      endTime: { gte: viewStart },
      startTime: { lt: viewEnd },
    },
    orderBy: { startTime: "asc" },
  });

  const username =
    (session.user as { username?: string }).username ??
    session.user.name ??
    session.user.email ??
    "uživatel";

  const serializedBlocks = blocks.map((b) => ({
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

  return (
    <TiskarMonitor
      initialBlocks={serializedBlocks}
      machine={assignedMachine}
      username={username}
    />
  );
}

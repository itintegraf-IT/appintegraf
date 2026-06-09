import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { prisma } from "@/lib/db";
import { ActivitiesTimeline } from "@/components/crm/ActivitiesTimeline";
import { serializeCrmUsers } from "@/lib/crm/users";

export default async function ActivitiesPage() {
  const user = await requireCrmRead();
  const mine = await prisma.crm_activities.findMany({
    where: {
      OR: [{ owner_id: user.id }, { assignee_id: user.id }],
    },
    include: {
      owner: { select: { id: true, first_name: true, last_name: true, email: true } },
      assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
    },
    orderBy: { date: "desc" },
    take: 100,
  });

  const [upcoming, users] = await Promise.all([
    prisma.crm_activities.findMany({
      where: {
        assignee_id: user.id,
        next_action_date: { gte: new Date() },
      },
      include: {
        owner: { select: { id: true, first_name: true, last_name: true, email: true } },
        assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
      orderBy: { next_action_date: "asc" },
      take: 50,
    }),
    prisma.users.findMany({
      select: { id: true, first_name: true, last_name: true, email: true },
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    }),
  ]);

  const usersForUi = serializeCrmUsers(users);

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Moje aktivity</h1>
      {upcoming.length > 0 ? (
        <section>
          <h2 className="mb-2 text-lg font-medium">Nadcházející next actions</h2>
          <ActivitiesTimeline
            activities={upcoming}
            currentUser={{ id: user.id, role: user.role }}
            users={usersForUi}
          />
        </section>
      ) : null}
      <section>
        <h2 className="mb-2 text-lg font-medium">Poslední aktivity</h2>
        <ActivitiesTimeline
          activities={mine}
          currentUser={{ id: user.id, role: user.role }}
          users={usersForUi}
        />
      </section>
    </div>
  );
}

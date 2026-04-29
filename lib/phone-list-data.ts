import { prisma } from "@/lib/db";
import { attachMembersToDepartments } from "@/lib/phone-list-members";
import { phoneListUserSelect, toPhoneListContact } from "@/lib/phone-list-user-select";

async function fetchSharedMails(search: string | undefined) {
  const list = await prisma.shared_mails.findMany({
    where: {
      AND: [
        { OR: [{ is_active: true }, { is_active: null }] },
        search
          ? {
              OR: [
                { email: { contains: search } },
                { label: { contains: search } },
                {
                  user_shared_mails: {
                    some: {
                      users: {
                        AND: [
                          { OR: [{ is_active: true }, { is_active: null }] },
                          { OR: [{ display_in_list: true }, { display_in_list: null }] },
                          {
                            OR: [
                              { first_name: { contains: search } },
                              { last_name: { contains: search } },
                            ],
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            }
          : {},
      ],
    },
    orderBy: [{ label: "asc" }, { email: "asc" }],
    include: {
      user_shared_mails: {
        include: {
          users: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              is_active: true,
              display_in_list: true,
            },
          },
        },
      },
    },
  });

  return list.map((m) => ({
    id: m.id,
    email: m.email,
    label: m.label,
    assignedUsers: m.user_shared_mails
      .map((x) => x.users)
      .filter((u) => u && u.is_active !== false && u.display_in_list !== false)
      .map((u) => ({
        id: u.id,
        fullName: `${u.first_name} ${u.last_name}`.trim(),
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "cs")),
  }));
}

function buildDepartmentWhere(search: string | undefined) {
  const and: Record<string, unknown>[] = [
    { OR: [{ is_active: true }, { is_active: null }] },
    { OR: [{ display_in_list: true }, { display_in_list: null }] },
  ];
  if (search) {
    and.push({
      OR: [
        { name: { contains: search } },
        { phone: { contains: search } },
        { landline: { contains: search } },
        { email: { contains: search } },
      ],
    });
  }
  return { AND: and };
}

function buildUserWhere(search: string | undefined) {
  const and: Record<string, unknown>[] = [
    { OR: [{ is_active: true }, { is_active: null }] },
    { OR: [{ display_in_list: true }, { display_in_list: null }] },
  ];
  if (search) {
    and.push({
      OR: [
        { first_name: { contains: search } },
        { last_name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { landline: { contains: search } },
        {
          user_shared_mails: {
            some: {
              shared_mails: {
                AND: [
                  { OR: [{ is_active: true }, { is_active: null }] },
                  {
                    OR: [{ email: { contains: search } }, { label: { contains: search } }],
                  },
                ],
              },
            },
          },
        },
      ],
    });
  }
  return { AND: and };
}

export async function getPhoneListPayload(tab: string, search: string) {
  if (search) {
    const [rawUsers, departments, sharedMails] = await Promise.all([
      prisma.users.findMany({
        where: buildUserWhere(search),
        orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
        select: phoneListUserSelect,
      }),
      prisma.departments.findMany({
        where: buildDepartmentWhere(search),
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          phone: true,
          landline: true,
          landline2: true,
          email: true,
          notes: true,
        },
      }),
      fetchSharedMails(search),
    ]);

    const primaryIds = [
      ...new Set(rawUsers.map((u) => u.department_id).filter((id): id is number => id != null && id > 0)),
    ];
    const primaryDepts =
      primaryIds.length > 0
        ? await prisma.departments.findMany({
            where: { id: { in: primaryIds } },
            select: { id: true, email: true },
          })
        : [];
    const primaryById: Record<number, { email: string | null }> = {};
    for (const d of primaryDepts) {
      primaryById[d.id] = { email: d.email };
    }

    const contacts = rawUsers.map((u) => toPhoneListContact(u, primaryById));
    const contactsByDepartment: Record<string, typeof contacts> = {};
    for (const c of contacts) {
      const dept = c.department_name || "Bez oddělení";
      if (!contactsByDepartment[dept]) contactsByDepartment[dept] = [];
      contactsByDepartment[dept].push(c);
    }
    const contactsByDepartmentSorted = Object.entries(contactsByDepartment).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const departmentsWithMembers = await attachMembersToDepartments(departments);

    return {
      unified: true,
      tab,
      search,
      contacts,
      contactsByDepartment: contactsByDepartmentSorted,
      departments: departmentsWithMembers,
      sharedMails,
    };
  }

  if (tab === "departments") {
    const departments = await prisma.departments.findMany({
      where: buildDepartmentWhere(undefined),
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        landline: true,
        landline2: true,
        email: true,
        notes: true,
      },
    });
    const departmentsWithMembers = await attachMembersToDepartments(departments);
    return { tab: "departments" as const, search: "", departments: departmentsWithMembers, unified: false as const };
  }

  if (tab === "shared-mails") {
    const sharedMails = await fetchSharedMails(undefined);
    return { tab: "shared-mails" as const, search: "", sharedMails, unified: false as const };
  }

  const rawUsers = await prisma.users.findMany({
    where: buildUserWhere(undefined),
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    select: phoneListUserSelect,
  });

  const primaryIds = [
    ...new Set(rawUsers.map((u) => u.department_id).filter((id): id is number => id != null && id > 0)),
  ];
  const primaryDepts =
    primaryIds.length > 0
      ? await prisma.departments.findMany({
          where: { id: { in: primaryIds } },
          select: { id: true, email: true },
        })
      : [];
  const primaryById: Record<number, { email: string | null }> = {};
  for (const d of primaryDepts) {
    primaryById[d.id] = { email: d.email };
  }

  const contacts = rawUsers.map((u) => toPhoneListContact(u, primaryById));
  const contactsByDepartment: Record<string, typeof contacts> = {};
  for (const c of contacts) {
    const dept = c.department_name || "Bez oddělení";
    if (!contactsByDepartment[dept]) contactsByDepartment[dept] = [];
    contactsByDepartment[dept].push(c);
  }

  return {
    unified: false,
    tab: "contacts" as const,
    search: "",
    contacts,
    contactsByDepartment: Object.entries(contactsByDepartment).sort(([a], [b]) => a.localeCompare(b)),
  };
}

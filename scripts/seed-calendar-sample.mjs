#!/usr/bin/env node
/**
 * Vzorové události kalendáře – cca 30 záznamů na příštích 20 dní,
 * různí uživatelé z kontaktů (tabulka users).
 *
 * Spuštění: npm run seed:calendar
 * Vyžaduje DATABASE_URL v .env (stejně jako ostatní skripty).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import dotenv from "dotenv";

dotenv.config();

function parseDatabaseUrl(url) {
  const u = new URL(url.replace(/^mysql:\/\//, "http://"));
  const database = u.pathname?.replace(/^\//, "").split("?")[0] || undefined;
  return {
    host: u.hostname || "localhost",
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: u.username || undefined,
    password: u.password || undefined,
    database,
    connectionLimit: 5,
    connectTimeout: 15000,
    allowPublicKeyRetrieval: true,
  };
}

const EVENT_TYPES = [
  "dovolena",
  "osobni",
  "schuzka_mimo_firmu",
  "sluzebni_cesta",
  "lekar",
  "nemoc",
  "jine",
];

const COLORS = ["#DC2626", "#2563EB", "#059669", "#D97706", "#7C3AED", "#DB2777", "#0891B2", "#65A30D"];

const TITLES = [
  "Dovolená",
  "Osobní",
  "Schůzka u zákazníka",
  "Služební cesta – Praha",
  "Lékař",
  "Nemoc",
  "Porada týmu",
  "Školení BOZP",
  "Kontrola výroby",
  "Oběd s klientem",
  "Home office",
  "Státní svátek – práce z domu",
  "Projektové řízení",
  "Kontrola stroje",
  "Individuální pohovor",
  "Firemní akce",
  "Dodávka materiálu",
  "Audit ISO",
  "Servisní zásah",
  "Plánování směn",
  "Konzultace s IT",
  "Předání zakázky",
  "Interní školení",
  "Schůzka vedení",
  "Kontrola kvality",
  "Příprava nabídky",
  "Zástup na recepci",
  "Školení obsluhy",
  "Externí školení",
  "Předání směny",
];

const LOCATIONS = [
  "Kancelář",
  "Praha",
  "Brno",
  "Ostrava",
  "Doma",
  "Zákazník",
  "Zasedačka A",
  null,
];

function dayStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(base, n) {
  const d = dayStart(base);
  d.setDate(d.getDate() + n);
  return d;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL není nastavena. Zkontrolujte .env");
    process.exit(1);
  }

  const poolConfig = parseDatabaseUrl(url);
  const adapter = new PrismaMariaDb(poolConfig);
  const prisma = new PrismaClient({ adapter });

  const users = await prisma.users.findMany({
    where: { is_active: true },
    select: { id: true, department_id: true },
    orderBy: { id: "asc" },
    take: 50,
  });

  if (users.length < 2) {
    console.error("❌ V databázi musí být alespoň 2 aktivní uživatelé.");
    await prisma.$disconnect();
    process.exit(1);
  }

  const ids = users.map((u) => u.id);
  const pickUser = (i) => ids[i % ids.length];
  const anotherUser = (excludeId) => {
    const others = ids.filter((id) => id !== excludeId);
    return others[randomInt(0, others.length - 1)] ?? excludeId;
  };

  const today = dayStart(new Date());
  const created = [];

  for (let i = 0; i < 30; i++) {
    const dayOffset = i % 20;
    const creatorId = pickUser(i + 3);
    const deptId = users.find((u) => u.id === creatorId)?.department_id ?? null;

    const eventType = EVENT_TYPES[i % EVENT_TYPES.length];
    const needsDeputy = eventType === "dovolena" || eventType === "osobni";
    const deputyId = needsDeputy ? anotherUser(creatorId) : null;

    const allDay = i % 5 === 0;
    const start = addDays(today, dayOffset);
    let end;

    if (allDay) {
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    } else {
      const h = 8 + (i % 9);
      start.setHours(h, (i * 17) % 60, 0, 0);
      end = new Date(start);
      end.setHours(h + 1 + (i % 3), end.getMinutes() + 30, 0, 0);
    }

    let approval_status = null;
    let requires_approval = false;
    if (needsDeputy && deputyId) {
      requires_approval = true;
      approval_status = i % 2 === 0 ? "approved" : "pending";
    }

    const title = `${TITLES[i % TITLES.length]} #${i + 1}`;

    const event = await prisma.calendar_events.create({
      data: {
        title,
        description: `Vzorová událost – seed skript (${new Date().toISOString().slice(0, 10)})`,
        start_date: start,
        end_date: end,
        event_type: eventType,
        created_by: creatorId,
        department_id: deptId,
        deputy_id: deputyId,
        requires_approval,
        approval_status,
        is_public: i % 4 === 0,
        color: COLORS[i % COLORS.length],
        location: LOCATIONS[i % LOCATIONS.length],
      },
    });

    if (needsDeputy && deputyId) {
      const depApproved = approval_status === "approved";
      await prisma.calendar_approvals.create({
        data: {
          event_id: event.id,
          approver_id: deputyId,
          approval_type: "deputy",
          approval_order: 1,
          status: depApproved ? "approved" : "pending",
          approved_at: depApproved ? new Date() : null,
        },
      });
    }

    if (i % 3 === 0 && ids.length >= 3) {
      const p1 = anotherUser(creatorId);
      const p2 = anotherUser(creatorId);
      if (p1 !== creatorId) {
        await prisma.calendar_event_participants.create({
          data: { event_id: event.id, user_id: p1, status: "accepted" },
        });
      }
      if (p2 !== creatorId && p2 !== p1) {
        await prisma.calendar_event_participants.create({
          data: { event_id: event.id, user_id: p2, status: "accepted" },
        });
      }
    }

    created.push(event.id);
  }

  console.log(`✅ Vytvořeno ${created.length} událostí kalendáře (ID: ${created.join(",")}).`);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

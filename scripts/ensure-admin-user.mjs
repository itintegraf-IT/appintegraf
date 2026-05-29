#!/usr/bin/env node
/**
 * Nouzové vytvoření / reset účtu administrátora (přihlášení jménem + heslem, bez 2FA).
 *
 * Vyžaduje DATABASE_URL v .env a heslo v proměnné ADMIN_BOOTSTRAP_PASSWORD
 * (min. 8 znaků, alespoň 1 písmeno a 1 číslice — stejná pravidla jako v aplikaci).
 *
 * Volitelně:
 *   ADMIN_BOOTSTRAP_USERNAME (výchozí: admin)
 *   ADMIN_BOOTSTRAP_EMAIL    (výchozí: admin-bootstrap@local.invalid)
 *
 * Spuštění:
 *   ADMIN_BOOTSTRAP_PASSWORD="VaseHeslo12" node scripts/ensure-admin-user.mjs
 *   npm run db:ensure-admin
 */
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

function parseDatabaseUrl(url) {
  const u = new URL(url.replace(/^mysql:\/\//, "http://"));
  const database = u.pathname?.replace(/^\//, "").split(/[?#]/)[0] || undefined;
  return {
    host: u.hostname || "localhost",
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: u.username || undefined,
    password: u.password || undefined,
    database,
    connectionLimit: 3,
    connectTimeout: 15000,
    allowPublicKeyRetrieval: true,
  };
}

function validateBootstrapPassword(password) {
  if (!password || password.length < 8) {
    return { ok: false, error: "Heslo musí mít alespoň 8 znaků." };
  }
  if (!/[A-Za-zÁ-ž]/.test(password) || !/\d/.test(password)) {
    return { ok: false, error: "Heslo musí obsahovat alespoň jedno písmeno a jednu číslici." };
  }
  return { ok: true };
}

function parseArgPassword() {
  const arg = process.argv.find((a) => a.startsWith("--password="));
  if (arg) return arg.slice("--password=".length);
  return process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim() ?? "";
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ Chybí DATABASE_URL (.env).");
    process.exit(1);
  }

  const plain = parseArgPassword();
  const v = validateBootstrapPassword(plain);
  if (!v.ok) {
    console.error(`❌ ${v.error}`);
    console.error("   Nastavte ADMIN_BOOTSTRAP_PASSWORD nebo předejte --password=…");
    process.exit(1);
  }

  const username = (process.env.ADMIN_BOOTSTRAP_USERNAME || "admin").trim().slice(0, 50);
  const preferredEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || "admin-bootstrap@local.invalid")
    .trim()
    .slice(0, 100);

  const poolConfig = parseDatabaseUrl(url);
  const adapter = new PrismaMariaDb(poolConfig);
  const prisma = new PrismaClient({ adapter });

  try {
    const roles = await prisma.roles.findMany();
    let adminRole = roles.find((r) => r.name?.toLowerCase() === "admin");
    if (!adminRole) {
      adminRole = await prisma.roles.create({
        data: {
          name: "admin",
          description: "Globální administrátor (bootstrap)",
          is_active: true,
        },
      });
      console.log("✓ Vytvořena role „admin“.");
    }

    const hash = await bcrypt.hash(plain, 12);

    let email = preferredEmail;
    const emailTaken = await prisma.users.findFirst({
      where: { email, NOT: { username } },
      select: { id: true },
    });
    if (emailTaken) {
      email = `${username}@bootstrap.local`;
    }

    const existing = await prisma.users.findUnique({ where: { username } });

    if (existing) {
      await prisma.user_totp_backup_codes.deleteMany({ where: { user_id: existing.id } });
      await prisma.user_tokens.deleteMany({ where: { user_id: existing.id } });
      await prisma.user_roles.deleteMany({ where: { user_id: existing.id } });
      await prisma.user_roles.create({
        data: {
          user_id: existing.id,
          role_id: adminRole.id,
          module_access: JSON.stringify({ all: true }),
        },
      });
      await prisma.users.update({
        where: { id: existing.id },
        data: {
          password_hash: hash,
          password_version: { increment: 1 },
          role_id: adminRole.id,
          totp_secret_enc: null,
          totp_enabled: false,
          totp_enrollment_required: false,
          is_active: true,
        },
      });
      console.log(`✓ Uživatel „${username}“ (id ${existing.id}) byl resetován: heslo, vypnuto 2FA, role admin.`);
    } else {
      const dept = await prisma.departments.findFirst({ orderBy: { id: "asc" } });
      const user = await prisma.users.create({
        data: {
          username,
          email,
          password_hash: hash,
          first_name: "Admin",
          last_name: "Bootstrap",
          role_id: adminRole.id,
          department_id: dept?.id ?? null,
          department_name: dept?.name ?? null,
          is_active: true,
          totp_enabled: false,
          totp_enrollment_required: false,
        },
      });
      await prisma.user_roles.create({
        data: {
          user_id: user.id,
          role_id: adminRole.id,
          module_access: JSON.stringify({ all: true }),
        },
      });
      console.log(`✓ Vytvořen uživatel „${username}“ (id ${user.id}), role admin.`);
    }

    console.log("");
    console.log("Přihlaste se v aplikaci uživatelským jménem a heslem nastaveným výše.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

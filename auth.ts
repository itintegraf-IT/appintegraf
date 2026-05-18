import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { verifyLoginChallenge } from "@/lib/login-challenge";
import { verifyTotpCodeEncrypted } from "@/lib/totp";
import { consumeBackupCode } from "@/lib/totp-backup-codes";
import { logAuthAudit, getRequestIp } from "@/lib/auth-audit";

async function loadUserForSession(userId: number) {
  const user = await prisma.users.findFirst({
    where: {
      id: userId,
      OR: [{ is_active: true }, { is_active: null }],
    },
  });
  if (!user) return null;

  return {
    id: String(user.id),
    name: `${user.first_name} ${user.last_name}`.trim(),
    email: user.email,
    image: null,
    username: user.username,
    roleId: user.role_id ?? undefined,
    departmentId: user.department_id ?? undefined,
    passwordVersion: user.password_version ?? 1,
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Uživatelské jméno", type: "text" },
        password: { label: "Heslo", type: "password" },
        loginChallenge: { label: "Challenge", type: "text" },
        totp: { label: "TOTP", type: "text" },
        backupCode: { label: "Záložní kód", type: "text" },
      },
      authorize: async (credentials) => {
        const loginChallenge = credentials?.loginChallenge as string | undefined;
        const totp = credentials?.totp as string | undefined;
        const backupCode = credentials?.backupCode as string | undefined;

        // Druhý krok přihlášení – 2FA po úspěšném pre-login
        if (loginChallenge) {
          const challenge = await verifyLoginChallenge(loginChallenge);
          if (!challenge) {
            return null;
          }

          const user = await prisma.users.findFirst({
            where: {
              id: challenge.userId,
              OR: [{ is_active: true }, { is_active: null }],
            },
            select: {
              id: true,
              password_version: true,
              totp_enabled: true,
              totp_secret_enc: true,
              first_name: true,
              last_name: true,
              email: true,
              username: true,
              role_id: true,
              department_id: true,
            },
          });

          if (
            !user ||
            !user.totp_enabled ||
            !user.totp_secret_enc ||
            user.password_version !== challenge.passwordVersion
          ) {
            return null;
          }

          let verified = false;
          let usedBackup = false;

          if (backupCode?.trim()) {
            verified = await consumeBackupCode(user.id, backupCode);
            usedBackup = verified;
          } else if (totp?.trim()) {
            verified = await verifyTotpCodeEncrypted(user.totp_secret_enc, totp);
          }

          if (!verified) {
            const ip = await getRequestIp();
            await logAuthAudit({
              userId: user.id,
              targetUserId: user.id,
              action: "totp_login_failed",
              ipAddress: ip,
            });
            return null;
          }

          if (usedBackup) {
            const ip = await getRequestIp();
            await logAuthAudit({
              userId: user.id,
              targetUserId: user.id,
              action: "totp_backup_used",
              ipAddress: ip,
            });
          }

          return await loadUserForSession(user.id);
        }

        // První krok – username + heslo (bez 2FA nebo přímý signIn po pre-login)
        const username = credentials?.username as string;
        const password = credentials?.password as string;

        if (!username || !password) {
          return null;
        }

        const user = await prisma.users.findFirst({
          where: {
            username: username.trim(),
            OR: [{ is_active: true }, { is_active: null }],
          },
        });

        if (!user) {
          return null;
        }

        const isValid =
          user.password_hash &&
          user.password_hash.length > 0 &&
          (await bcrypt.compare(password, user.password_hash));

        if (!isValid) {
          return null;
        }

        if (user.totp_enabled && user.totp_secret_enc) {
          return null;
        }

        if (user.totp_enrollment_required && !user.totp_enabled) {
          return null;
        }

        return {
          id: String(user.id),
          name: `${user.first_name} ${user.last_name}`.trim(),
          email: user.email,
          image: null,
          username: user.username,
          roleId: user.role_id ?? undefined,
          departmentId: user.department_id ?? undefined,
          passwordVersion: user.password_version ?? 1,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as { username?: string }).username;
        token.roleId = (user as { roleId?: number }).roleId;
        token.departmentId = (user as { departmentId?: number }).departmentId;
        token.passwordVersion = (user as { passwordVersion?: number }).passwordVersion ?? 1;
      }

      if (token?.id) {
        try {
          const idNum = parseInt(token.id as string, 10);
          if (!isNaN(idNum)) {
            const row = await prisma.users.findUnique({
              where: { id: idNum },
              select: { password_version: true, is_active: true },
            });
            if (!row || row.is_active === false) return null;
            const tokenPv = (token.passwordVersion as number | undefined) ?? 1;
            if (row.password_version !== tokenPv) {
              return null;
            }
          }
        } catch {
          // ignore – raději session neruš při DB výpadku
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { username?: string }).username = token.username as string;
        (session.user as { roleId?: number }).roleId = token.roleId as number;
        (session.user as { departmentId?: number }).departmentId = token.departmentId as number;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 3600,
  },
});

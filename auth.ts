import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Uživatelské jméno", type: "text" },
        password: { label: "Heslo", type: "password" },
      },
      authorize: async (credentials) => {
        const username = credentials?.username as string;
        const password = credentials?.password as string;

        if (!username || !password) {
          return null;
        }

        // Stejná sémantika jako kontakty / phone-list: aktivní = true nebo NULL (legacy řádky)
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

        return {
          id: String(user.id),
          name: `${user.first_name} ${user.last_name}`.trim(),
          email: user.email,
          image: null,
          username: user.username,
          roleId: user.role_id ?? undefined,
          departmentId: user.department_id ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as { username?: string }).username;
        token.roleId = (user as { roleId?: number }).roleId;
        token.departmentId = (user as { departmentId?: number }).departmentId;
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
    maxAge: 3600, // 1 hodina (stejně jako PHP SESSION_TIMEOUT)
  },
});

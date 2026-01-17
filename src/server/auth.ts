import { getServerSession } from "next-auth";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  // Keep adapter so users/roles exist in DB
  adapter: PrismaAdapter(prisma),

  // ✅ REQUIRED for Credentials provider
  session: { strategy: "jwt" },

  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    Credentials({
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password ?? "";
        if (!email) return null;

        const adminEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
        const adminPassword = process.env.ADMIN_PASSWORD ?? "";
        if (!adminEmail || !adminPassword) {
          throw new Error("ADMIN_EMAIL/ADMIN_PASSWORD not set");
        }

        // Only allow the bootstrap admin (for now)
        if (email !== adminEmail) return null;

        // Create user if missing
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          const hash = await bcrypt.hash(adminPassword, 10);

          await prisma.settings.upsert({
            where: { key: "auth.bootstrapAdminPasswordHash" },
            update: { value: { hash } },
            create: { key: "auth.bootstrapAdminPasswordHash", value: { hash } },
          });

          user = await prisma.user.create({
            data: { email, name: "Admin" },
          });

          const adminRole = await prisma.role.findUnique({ where: { key: "admin" } });
          if (!adminRole) throw new Error("Role 'admin' missing. Run seed.");
          await prisma.userRole.create({
            data: { userId: user.id, roleId: adminRole.id },
          });
        }

        // Verify password
        const setting = await prisma.settings.findUnique({
          where: { key: "auth.bootstrapAdminPasswordHash" },
        });

        const hash = (setting?.value as any)?.hash as string | undefined;
        if (!hash) return null;

        const ok = await bcrypt.compare(password, hash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],

  pages: { signIn: "/login" },

  callbacks: {
    async jwt({ token, user }) {
      // Persist user id into token on sign-in
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      // Expose user id in session for server checks
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};

export async function auth() {
  return getServerSession(authOptions);
}

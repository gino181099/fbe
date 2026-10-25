import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ACCESS_PASSWORD, AUTH_SECRET } from "@/lib/config";
import { LOGIN_USERS } from "@/lib/constants";

const credentialsSchema = z.object({ username: z.string(), password: z.string().min(1) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: AUTH_SECRET,
  // JWT es obligatorio para usar el login con contraseña.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success || parsed.data.password !== ACCESS_PASSWORD) return null;
        const login = LOGIN_USERS.find((u) => u.username === parsed.data.username);
        if (!login) return null;
        // Los usuarios los crea la migración 0013; el upsert cubre una base restaurada de antes.
        const [user] = await db
          .insert(users)
          .values({ username: login.username, name: login.name, status: "active", isAdmin: true })
          .onConflictDoUpdate({ target: users.username, set: { status: "active", isAdmin: true } })
          .returning();
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

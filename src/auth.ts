import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ACCESS_PASSWORD, AUTH_SECRET } from "@/lib/config";

const credentialsSchema = z.object({ password: z.string().min(1) });

/** Usuario compartido con el que entran todos (clave única, acceso total). */
const SHARED_USERNAME = "frabel";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: AUTH_SECRET,
  // JWT es obligatorio para usar el login con contraseña.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success || parsed.data.password !== ACCESS_PASSWORD) return null;
        // Se crea la primera vez (base nueva) y se mantiene activo y con acceso total.
        const [user] = await db
          .insert(users)
          .values({ username: SHARED_USERNAME, name: "Frabel", status: "active", isAdmin: true })
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

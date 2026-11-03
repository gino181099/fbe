import { and, eq, gte, lt, sql } from "drizzle-orm";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/db";
import { loginFailures, users } from "@/db/schema";
import { ACCESS_PASSWORD, AUTH_SECRET } from "@/lib/config";
import { LOGIN_USERS } from "@/lib/constants";
import { blockedMinutes, clientIp, LOGIN_WINDOW_MS } from "@/lib/login-limit";

const credentialsSchema = z.object({ username: z.string(), password: z.string().min(1) });

/** Demasiados intentos fallidos desde la misma IP; `code` lleva los minutos de espera (lo lee el login). */
export class LoginBlocked extends CredentialsSignin {
  constructor(minutes: number) {
    super();
    this.code = `bloqueado:${minutes}`;
  }
}

/** Lanza `LoginBlocked` si la IP agotó los intentos. Se chequea antes de comparar la clave (también vale para /api/auth). */
async function assertNotBlocked(ip: string) {
  // Antigüedad calculada con el reloj de la base: `created_at` es timestamp sin zona y un Date de JS se desfasaría.
  const rows = await db
    .select({ ageMs: sql<number>`extract(epoch from now() - ${loginFailures.createdAt}) * 1000` })
    .from(loginFailures)
    .where(and(eq(loginFailures.ip, ip), gte(loginFailures.createdAt, sql`now() - make_interval(secs => ${LOGIN_WINDOW_MS / 1000})`)));
  const now = new Date();
  const minutes = blockedMinutes(
    rows.map((r) => new Date(now.getTime() - Number(r.ageMs))),
    now,
  );
  if (minutes) throw new LoginBlocked(minutes);
}

async function recordFailure(ip: string) {
  // De paso se limpian los fallos viejos (ya no cuentan).
  await db.delete(loginFailures).where(lt(loginFailures.createdAt, sql`now() - interval '1 day'`));
  await db.insert(loginFailures).values({ ip });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: AUTH_SECRET,
  // JWT es obligatorio para usar el login con contraseña.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(raw, request) {
        const ip = clientIp(request.headers);
        await assertNotBlocked(ip);
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success || parsed.data.password !== ACCESS_PASSWORD) {
          await recordFailure(ip);
          return null;
        }
        const login = LOGIN_USERS.find((u) => u.username === parsed.data.username);
        if (!login) return null;
        await db.delete(loginFailures).where(eq(loginFailures.ip, ip));
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

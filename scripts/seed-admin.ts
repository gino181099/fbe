// Crea (o reactiva) el usuario administrador local.
// Uso: npm run db:seed-admin   (variables ADMIN_USERNAME / ADMIN_PASSWORD opcionales)
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { MODULES, permissions, users } from "../src/db/schema";

const username = process.env.ADMIN_USERNAME ?? "frabel";
const password = process.env.ADMIN_PASSWORD ?? "2156";

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const [existing] = await db.select().from(users).where(eq(users.username, username));

  let userId: string;
  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, status: "active", isAdmin: true })
      .where(eq(users.id, existing.id));
    userId = existing.id;
    console.log(`Admin "${username}" actualizado.`);
  } else {
    const [created] = await db
      .insert(users)
      .values({ name: "Administrador", username, passwordHash, status: "active", isAdmin: true })
      .returning({ id: users.id });
    userId = created.id;
    console.log(`Admin "${username}" creado.`);
  }

  await db
    .insert(permissions)
    .values(MODULES.map((module) => ({ userId, module, level: "edit" as const })))
    .onConflictDoUpdate({
      target: [permissions.userId, permissions.module],
      set: { level: "edit" },
    });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

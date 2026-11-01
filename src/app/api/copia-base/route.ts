import { gzipSync } from "node:zlib";
import { Client } from "pg";
import { DATABASE_URL } from "@/lib/config";
import { DB_DOWNLOAD_USERS } from "@/lib/constants";
import { dumpFileName, rawTypes, readAll } from "@/lib/db-dump";
import { pgConnection } from "@/lib/pg-connection";
import { getCurrentUser } from "@/lib/permissions";

/** Copia completa de la base, en el mismo formato que los backups (se carga con `npm run db:restore -- <archivo>`). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.status !== "active" || !DB_DOWNLOAD_USERS.includes(user.username ?? "")) {
    return new Response("No autorizado", { status: 403 });
  }
  // Conexión propia (no el pool de Drizzle): los valores tienen que llegar como texto.
  const c = new Client({ ...pgConnection(DATABASE_URL), types: rawTypes });
  await c.connect();
  const dump = await readAll(c).finally(() => c.end());
  return new Response(new Uint8Array(gzipSync(JSON.stringify(dump))), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${dumpFileName()}"`,
      "Cache-Control": "no-store",
    },
  });
}

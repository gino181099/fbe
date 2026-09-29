// Importa la lista de clientes potenciales (JSON del relevamiento) como contactos
// tipo/estado "potencial" en etapa "sin_contactar", con una nota automática inicial.
// Es idempotente: omite los nombres que ya existen (lower(trim(name))) sin modificarlos,
// y la nota de importación no se duplica. Por defecto solo SIMULA.
//
// Uso: npm run db:import-potenciales -- <archivo.json> [--aplicar]
import { readFileSync } from "node:fs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../src/db";
import { clientNotes, clients } from "../src/db/schema";
import { mapProspect, normalizeName, type ProspectJson } from "../src/lib/prospects";

const NOTE_TEXT = "Importado de la lista de prospectos 2026-09-28";

const args = process.argv.slice(2);
const apply = args.includes("--aplicar");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Uso: npm run db:import-potenciales -- <archivo.json> [--aplicar]");
  process.exit(1);
}

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

async function main() {
  const json = JSON.parse(readFileSync(file!, "utf8")) as { clientes?: ProspectJson[] } | ProspectJson[];
  const list = Array.isArray(json) ? json : (json.clientes ?? []);
  const rows = list.filter((p) => p?.nombre?.trim()).map(mapProspect);

  const existing = await db.select({ name: sql<string>`lower(trim(${clients.name}))` }).from(clients);
  const known = new Set(existing.map((e) => e.name));
  const seen = new Set<string>();
  const toCreate: typeof rows = [];
  const skipped: string[] = [];
  for (const r of rows) {
    const key = normalizeName(r.name);
    if (known.has(key) || seen.has(key)) skipped.push(r.name);
    else toCreate.push(r);
    seen.add(key);
  }

  console.log(`Prospectos en el archivo: ${rows.length}`);
  console.log(`${apply ? "Crea" : "Crearía"}: ${toCreate.length}`);
  console.log(`Omite (ya existen): ${skipped.length}${skipped.length ? ` → ${skipped.join(", ")}` : ""}`);

  // Contactos del archivo que siguen como potenciales y no tienen la nota de importación.
  const names = rows.map((r) => r.name);
  const pendingNotes = async () =>
    db
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(
          inArray(clients.name, names),
          eq(clients.type, "potencial"),
          sql`not exists (select 1 from ${clientNotes} n where n.client_id = ${clients.id} and n.text = ${NOTE_TEXT})`,
        ),
      );

  if (!apply) {
    const notes = await pendingNotes();
    console.log(`Notas iniciales que agregaría (sin contar los nuevos): ${notes.length}`);
    console.log("\nSimulación: no se escribió nada. Usá --aplicar para guardar.");
    return;
  }

  const created = toCreate.length
    ? await db
        .insert(clients)
        .values(toCreate)
        .onConflictDoNothing({ target: clients.name })
        .returning({ id: clients.id })
    : [];

  const notes = await pendingNotes();
  if (notes.length) {
    const date = today();
    await db
      .insert(clientNotes)
      .values(notes.map((n) => ({ clientId: n.id, date, text: NOTE_TEXT, auto: true, userId: null })));
  }
  console.log(`\nCreados: ${created.length} · Notas iniciales agregadas: ${notes.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

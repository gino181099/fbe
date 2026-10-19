"use server";

import { and, count, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { CLIENT_STATUSES, CLIENT_TYPES, clientNotes, clients, collections, documents, rates, receipts, routes, trips } from "@/db/schema";
import { LEAD_PRIORITIES, LEAD_STAGE_LABELS, LEAD_STAGES } from "@/lib/constants";
import { isUniqueViolation } from "@/lib/db-errors";
import { today } from "@/lib/format";
import { firstError, formToObject, zDate, zMoney, zText } from "@/lib/forms";
import { type ActionResult, checkPermission } from "@/lib/permissions";
import { canDeleteNote, formLeadStage, stageTransition } from "@/lib/prospects";
import { applyNewRates } from "@/lib/rates";

const clientSchema = z.object({
  name: z.string({ error: "El nombre es obligatorio" }).min(1).max(200),
  type: z.enum(CLIENT_TYPES),
  status: z.enum(CLIENT_STATUSES),
  cuit: zText,
  contactPerson: zText,
  phone: zText,
  email: z.email({ error: "Email inválido" }).optional(),
  address: zText,
  website: zText,
  segment: zText,
  leadPriority: z.enum(LEAD_PRIORITIES, { error: "Prioridad inválida" }).optional(),
  notes: zText,
});

function nullify<T extends Record<string, unknown>>(obj: T) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v ?? null])) as {
    [K in keyof T]-?: undefined extends T[K] ? Exclude<T[K], undefined> | null : T[K];
  };
}

export async function createClient(formData: FormData): Promise<ActionResult> {
  const { error } = await checkPermission("contactos");
  if (error) return error;
  const parsed = clientSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const stage = formLeadStage(parsed.data.type, parsed.data.status, null);
  if (!stage.ok) return { ok: false, error: stage.error };
  let id: number;
  try {
    [{ id }] = await db
      .insert(clients)
      .values({ ...nullify(parsed.data), leadStage: stage.leadStage })
      .returning({ id: clients.id });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "Ya existe un contacto con ese nombre." };
    throw e;
  }
  revalidatePath("/contactos");
  redirect(`/contactos/${id}`);
}

export async function updateClient(id: number, formData: FormData): Promise<ActionResult> {
  const { user, error } = await checkPermission("contactos");
  if (error) return error;
  const parsed = clientSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  // Solo cuentan los recorridos: un potencial puede tener un tarifario cotizado (ver saveRateVersion).
  const [[current], [t]] = await Promise.all([
    db.select({ leadStage: clients.leadStage }).from(clients).where(eq(clients.id, id)),
    db.select({ n: count() }).from(trips).where(eq(trips.clientId, id)),
  ]);
  if (!current) return { ok: false, error: "El contacto no existe." };
  const stage = formLeadStage(parsed.data.type, parsed.data.status, current.leadStage, t.n > 0);
  if (!stage.ok) return { ok: false, error: stage.error };
  const from = current.leadStage;
  const to = stage.leadStage;
  const update = db
    .update(clients)
    .set({ ...nullify(parsed.data), leadStage: to })
    .where(eq(clients.id, id));
  try {
    if (to && to !== from) {
      // El cambio de etapa hecho desde el formulario también queda en el seguimiento.
      await db.batch([
        update,
        db.insert(clientNotes).values({
          clientId: id,
          date: today(),
          text: `Etapa: ${from ? LEAD_STAGE_LABELS[from] : "—"} → ${LEAD_STAGE_LABELS[to]}`,
          auto: true,
          userId: user.id,
        }),
      ]);
    } else {
      await update;
    }
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "Ya existe un contacto con ese nombre." };
    throw e;
  }
  revalidatePath("/contactos");
  revalidatePath(`/contactos/${id}`);
  return { ok: true, message: "Contacto actualizado" };
}

export async function deleteClient(id: number): Promise<ActionResult> {
  const { error } = await checkPermission("contactos");
  if (error) return error;
  const [[t], [c], [d], [r]] = await Promise.all([
    db.select({ n: count() }).from(trips).where(eq(trips.clientId, id)),
    db.select({ n: count() }).from(collections).where(eq(collections.clientId, id)),
    db.select({ n: count() }).from(documents).where(eq(documents.clientId, id)),
    db.select({ n: count() }).from(receipts).where(eq(receipts.clientId, id)),
  ]);
  if (t.n > 0 || c.n > 0 || d.n > 0 || r.n > 0) {
    return {
      ok: false,
      error: `No se puede eliminar: tiene ${t.n} recorridos, ${c.n} cobros, ${r.n} recibos y ${d.n} comprobantes. Podés marcarlo como inactivo.`,
    };
  }
  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/contactos");
  redirect("/contactos");
}

/* ─────────────────────────────── Tarifario ─────────────────────────────── */

const rateSchema = z.object({
  routeId: z.coerce.number().int().positive({ error: "Elegí un recorrido" }),
  capacity: z.coerce.number().int().positive({ error: "Capacidad inválida" }),
  price: zMoney,
  validFrom: zDate,
  validTo: zDate.optional(),
});

export async function updateRate(clientId: number, rateId: number, formData: FormData): Promise<ActionResult> {
  const { error } = await checkPermission("contactos");
  if (error) return error;
  const parsed = rateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  if (d.validTo && d.validTo < d.validFrom) return { ok: false, error: "La fecha hasta es anterior a la fecha desde." };
  await db
    .update(rates)
    .set({ ...d, validTo: d.validTo ?? null })
    .where(eq(rates.id, rateId));
  revalidatePath(`/contactos/${clientId}`);
  return { ok: true, message: "Tarifa actualizada" };
}

export async function deleteRate(clientId: number, rateId: number): Promise<ActionResult> {
  const { error } = await checkPermission("contactos");
  if (error) return error;
  const [{ n }] = await db.select({ n: count() }).from(trips).where(eq(trips.rateId, rateId));
  if (n > 0) {
    return {
      ok: false,
      error: `Esta tarifa se usó en ${n} recorridos. En lugar de borrarla, cargá una versión nueva o ponele fecha de fin.`,
    };
  }
  await db.delete(rates).where(eq(rates.id, rateId));
  revalidatePath(`/contactos/${clientId}`);
  return { ok: true, message: "Tarifa eliminada" };
}

const versionSchema = z.object({
  validFrom: zDate,
  recalculate: z.boolean(),
  items: z
    .array(
      z.object({
        routeId: z.number().int().positive().optional(),
        routeName: z.string().trim().min(1).max(200).optional(),
        capacity: z.number().int().positive({ error: "Capacidad inválida" }),
        price: z.number().nonnegative({ error: "Precio inválido" }),
      }),
    )
    .min(1, { error: "No hay tarifas para guardar" }),
});

export type RateVersionInput = z.infer<typeof versionSchema>;

/** Guarda una nueva versión del tarifario (precios cargados a mano o desde un archivo). */
export async function saveRateVersion(clientId: number, input: RateVersionInput): Promise<ActionResult> {
  const { error } = await checkPermission("contactos");
  if (error) return error;
  const parsed = versionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { validFrom, recalculate, items } = parsed.data;

  // Recorridos nuevos escritos a mano o que vienen del archivo.
  const newNames = [...new Set(items.filter((i) => !i.routeId && i.routeName).map((i) => i.routeName!))];
  if (newNames.length) {
    await db
      .insert(routes)
      .values(newNames.map((name) => ({ name })))
      .onConflictDoNothing({ target: routes.name });
  }
  const routeRows = newNames.length ? await db.select().from(routes).where(inArray(routes.name, newNames)) : [];
  const byName = new Map(routeRows.map((r) => [r.name, r.id]));

  const resolved = items.map((i) => ({
    routeId: i.routeId ?? byName.get(i.routeName!)!,
    capacity: i.capacity,
    price: i.price,
  }));
  if (resolved.some((r) => !r.routeId)) return { ok: false, error: "Hay filas sin recorrido." };
  const keys = new Set(resolved.map((r) => `${r.routeId}-${r.capacity}`));
  if (keys.size !== resolved.length) return { ok: false, error: "Hay recorridos + capacidad repetidos." };

  // Un cliente con tarifario pasa a ser recurrente (un potencial elige su tipo al marcarlo como ganado).
  await db
    .update(clients)
    .set({ type: "recurrente" })
    .where(and(eq(clients.id, clientId), ne(clients.type, "potencial")));
  await applyNewRates(clientId, validFrom, resolved, recalculate);

  revalidatePath(`/contactos/${clientId}`);
  revalidatePath("/ventas");
  return { ok: true, message: `Tarifario guardado (${resolved.length} tarifas)` };
}

/* ─────────────────────────── Embudo y seguimiento ─────────────────────────── */

function revalidateClient(clientId: number) {
  revalidatePath("/contactos");
  revalidatePath(`/contactos/${clientId}`);
}

const stageSchema = z.object({
  leadStage: z.enum(LEAD_STAGES, { error: "Elegí una etapa" }),
  type: z.string().optional(),
});

/** Mueve un potencial de etapa y deja la nota automática en el seguimiento. */
export async function changeLeadStage(clientId: number, formData: FormData): Promise<ActionResult> {
  const { user, error } = await checkPermission("contactos");
  if (error) return error;
  const parsed = stageSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const [client] = await db.select({ leadStage: clients.leadStage }).from(clients).where(eq(clients.id, clientId));
  if (!client) return { ok: false, error: "El contacto no existe." };
  if (!client.leadStage) return { ok: false, error: "Este contacto no está en el embudo de potenciales." };
  const t = stageTransition(client.leadStage, parsed.data.leadStage, parsed.data.type);
  if (!t.ok) return { ok: false, error: t.error };
  await db.batch([
    db.update(clients).set({ leadStage: t.leadStage, status: t.status, type: t.type }).where(eq(clients.id, clientId)),
    db.insert(clientNotes).values({ clientId, date: today(), text: t.noteText, auto: true, userId: user.id }),
  ]);
  revalidateClient(clientId);
  revalidatePath("/ventas");
  if (t.leadStage === "ganado") {
    const extra = t.type === "recurrente" ? " Cargá su tarifario." : "";
    return { ok: true, message: `¡Cliente ganado! Ahora es un cliente activo.${extra}` };
  }
  return { ok: true, message: "Etapa actualizada" };
}

const noteSchema = z.object({
  date: zDate,
  text: z
    .string({ error: "Escribí la observación" })
    .min(1, "Escribí la observación")
    .max(2000, "La observación no puede superar los 2000 caracteres"),
});

export async function addClientNote(clientId: number, formData: FormData): Promise<ActionResult> {
  const { user, error } = await checkPermission("contactos");
  if (error) return error;
  const parsed = noteSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  await db.insert(clientNotes).values({ clientId, ...parsed.data, auto: false, userId: user.id });
  revalidateClient(clientId);
  return { ok: true, message: "Observación agregada" };
}

/** Solo el autor borra sus observaciones; las automáticas no se borran (ni el admin). */
export async function deleteClientNote(clientId: number, noteId: number): Promise<ActionResult> {
  const { user, error } = await checkPermission("contactos");
  if (error) return error;
  const [note] = await db
    .select({ auto: clientNotes.auto, userId: clientNotes.userId })
    .from(clientNotes)
    .where(and(eq(clientNotes.id, noteId), eq(clientNotes.clientId, clientId)));
  if (!note) return { ok: false, error: "La observación no existe." };
  if (note.auto) return { ok: false, error: "Las observaciones automáticas no se pueden borrar." };
  if (!canDeleteNote(note, user.id)) return { ok: false, error: "Solo el autor puede borrar esta observación." };
  await db.delete(clientNotes).where(eq(clientNotes.id, noteId));
  revalidateClient(clientId);
  return { ok: true, message: "Observación eliminada" };
}

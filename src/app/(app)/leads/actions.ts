"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { OPPORTUNITY_STAGES, clients, leadNotes, leads } from "@/db/schema";
import { created, updated } from "@/lib/audit";
import { LEAD_PRIORITIES } from "@/lib/constants";
import { today } from "@/lib/format";
import { firstError, formToObject, zDate, zIntOpt, zMoneyOpt, zText } from "@/lib/forms";
import { moveLead } from "@/lib/leads";
import { type ActionResult, checkPermission } from "@/lib/permissions";
import { canDeleteNote } from "@/lib/prospects";

const leadSchema = z.object({
  title: z.string({ error: "El título es obligatorio" }).min(1, "El título es obligatorio").max(200),
  clientId: zIntOpt,
  company: z.string().max(200, "Máximo 200 caracteres").optional(),
  contactPerson: zText,
  phone: zText,
  email: z.email({ error: "Email inválido" }).optional(),
  website: zText,
  address: zText,
  segment: zText,
  priority: z.enum(LEAD_PRIORITIES, { error: "Prioridad inválida" }).optional(),
  expectedAmount: zMoneyOpt,
  expectedClose: zDate.optional(),
  ownerId: z.string().optional(),
  nextAction: zText,
  nextActionDate: zDate.optional(),
  notes: zText,
});

function nullify<T extends Record<string, unknown>>(obj: T) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v ?? null])) as {
    [K in keyof T]-?: undefined extends T[K] ? Exclude<T[K], undefined> | null : T[K];
  };
}

function revalidateLead(id: number, clientId?: number | null) {
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  if (clientId) {
    revalidatePath("/contactos");
    revalidatePath(`/contactos/${clientId}`);
  }
}

/** Valida el formulario; sin empresa escrita usa el nombre del cliente vinculado. */
async function parseLead(formData: FormData) {
  const parsed = leadSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) } as const;
  const data = nullify(parsed.data);
  if (data.clientId) {
    const [c] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, data.clientId));
    if (!c) return { error: "El cliente elegido no existe." } as const;
    data.company ||= c.name;
  }
  if (!data.company) return { error: "Indicá la empresa o elegí un cliente." } as const;
  return { data: { ...data, company: data.company } } as const;
}

export async function createLead(formData: FormData): Promise<ActionResult> {
  const { user, error } = await checkPermission("leads");
  if (error) return error;
  const parsed = await parseLead(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error! };
  const [{ id }] = await db
    .insert(leads)
    .values({ ...parsed.data, ownerId: parsed.data.ownerId ?? user.id, ...created(user.id) })
    .returning({ id: leads.id });
  revalidateLead(id, parsed.data.clientId);
  redirect(`/leads/${id}`);
}

export async function updateLead(id: number, formData: FormData): Promise<ActionResult> {
  const { user, error } = await checkPermission("leads");
  if (error) return error;
  const parsed = await parseLead(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error! };
  const [row] = await db.update(leads).set({ ...parsed.data, ...updated(user.id) }).where(eq(leads.id, id)).returning({ id: leads.id });
  if (!row) return { ok: false, error: "La oportunidad no existe." };
  revalidateLead(id, parsed.data.clientId);
  return { ok: true, message: "Oportunidad guardada" };
}

export async function deleteLead(id: number): Promise<ActionResult> {
  const { error } = await checkPermission("leads");
  if (error) return error;
  await db.delete(leads).where(eq(leads.id, id));
  revalidatePath("/leads");
  redirect("/leads");
}

const stageSchema = z.object({
  stage: z.enum(OPPORTUNITY_STAGES, { error: "Elegí una etapa" }),
  type: z.string().optional(),
  lostReason: z.string().max(500, "Máximo 500 caracteres").optional(),
});

/**
 * Mueve la oportunidad de etapa (Kanban o botón) y deja la nota automática.
 * Ganado crea el cliente (o vincula uno con el mismo nombre) o activa al potencial vinculado.
 */
export async function changeLeadStage(id: number, formData: FormData): Promise<ActionResult> {
  const { user, error } = await checkPermission("leads");
  if (error) return error;
  const parsed = stageSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) return { ok: false, error: "La oportunidad no existe." };

  const date = today();
  const [linked] = lead.clientId
    ? await db.select({ id: clients.id, type: clients.type }).from(clients).where(eq(clients.id, lead.clientId))
    : [];
  const move = moveLead(lead.stage, parsed.data.stage, {
    date,
    client: linked ?? null,
    type: parsed.data.type,
    lostReason: parsed.data.lostReason,
  });
  if (!move.ok) return { ok: false, error: move.error };

  let clientId = lead.clientId;
  let message = "Etapa actualizada";
  if (move.client.action === "create") {
    // Si ya existe un contacto con ese nombre, se vincula en vez de duplicarlo.
    const [existing] = await db
      .select({ id: clients.id, type: clients.type })
      .from(clients)
      .where(sql`lower(${clients.name}) = lower(${lead.company})`);
    if (existing) {
      clientId = existing.id;
      if (existing.type === "potencial") {
        await db
          .update(clients)
          .set({ type: move.client.type, status: "activo", leadStage: "ganado", ...updated(user.id) })
          .where(eq(clients.id, existing.id));
      }
      message = "¡Ganada! Se vinculó al contacto existente con ese nombre.";
    } else {
      [{ id: clientId }] = await db
        .insert(clients)
        .values({
          name: lead.company,
          type: move.client.type,
          status: "activo",
          contactPerson: lead.contactPerson,
          phone: lead.phone,
          email: lead.email,
          website: lead.website,
          address: lead.address,
          segment: lead.segment,
          leadPriority: lead.priority,
          leadStage: "ganado",
          ...created(user.id),
        })
        .returning({ id: clients.id });
      message = "¡Ganada! Se creó el cliente en Contactos.";
    }
  } else if (move.client.action === "convert" && clientId) {
    await db
      .update(clients)
      .set({ type: move.client.type, status: "activo", leadStage: "ganado", ...updated(user.id) })
      .where(eq(clients.id, clientId));
    message = "¡Ganada! El contacto ahora es un cliente activo.";
  } else if (move.client.action === "lose" && clientId) {
    await db.update(clients).set({ status: "inactivo", leadStage: "perdido", ...updated(user.id) }).where(eq(clients.id, clientId));
  }

  await db.transaction(async (tx) => {
    await tx
      .update(leads)
      .set({ stage: move.stage, closedAt: move.closedAt, lostReason: move.lostReason, clientId, ...updated(user.id) })
      .where(eq(leads.id, id));
    await tx.insert(leadNotes).values({ leadId: id, date, text: move.noteText, auto: true, userId: user.id });
  });
  revalidateLead(id, clientId);
  if (move.client.action !== "none") revalidatePath("/ventas");
  if (move.client.action === "create" || move.client.action === "convert") {
    if (move.client.type === "recurrente") message += " Cargale el tarifario.";
  }
  return { ok: true, message };
}

const noteSchema = z.object({
  date: zDate,
  text: z
    .string({ error: "Escribí la nota" })
    .min(1, "Escribí la nota")
    .max(2000, "La nota no puede superar los 2000 caracteres"),
});

export async function addLeadNote(leadId: number, formData: FormData): Promise<ActionResult> {
  const { user, error } = await checkPermission("leads");
  if (error) return error;
  const parsed = noteSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  await db.insert(leadNotes).values({ leadId, ...parsed.data, auto: false, userId: user.id });
  revalidateLead(leadId);
  return { ok: true, message: "Nota agregada" };
}

/** Solo el autor borra sus notas; las automáticas no se borran (ni el admin). */
export async function deleteLeadNote(leadId: number, noteId: number): Promise<ActionResult> {
  const { user, error } = await checkPermission("leads");
  if (error) return error;
  const [note] = await db
    .select({ auto: leadNotes.auto, userId: leadNotes.userId })
    .from(leadNotes)
    .where(and(eq(leadNotes.id, noteId), eq(leadNotes.leadId, leadId)));
  if (!note) return { ok: false, error: "La nota no existe." };
  if (note.auto) return { ok: false, error: "Las notas automáticas no se pueden borrar." };
  if (!canDeleteNote(note, user.id)) return { ok: false, error: "Solo el autor puede borrar esta nota." };
  await db.delete(leadNotes).where(eq(leadNotes.id, noteId));
  revalidateLead(leadId);
  return { ok: true, message: "Nota eliminada" };
}

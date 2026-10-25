"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clients, documentItems, documents, routes, trips } from "@/db/schema";
import { CC_START, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from "@/lib/constants";
import { created, updated } from "@/lib/audit";
import { isUniqueViolation } from "@/lib/db-errors";
import { formatDocNumber } from "@/lib/doc-number";
import {
  allowsRelated,
  hasDueDate,
  itemsTotal,
  usesSingleAmount,
  usesTrips,
  validateDocumentDraft,
} from "@/lib/document-rules";
import { nextInternalNumber, tripsInActiveDocument } from "@/lib/documents";
import { firstError, formToObject, zDate } from "@/lib/forms";
import { addDays, tripDescription } from "@/lib/ledger";
import { type ActionResult, checkPermission } from "@/lib/permissions";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
const optInt = z.number().int().nullish().transform((v) => v ?? null);

const documentSchema = z.object({
  clientId: z.number({ error: "Elegí un cliente" }).int().positive({ error: "Elegí un cliente" }),
  type: z.enum(DOCUMENT_TYPES, { error: "Tipo inválido" }),
  date: zDate,
  dueDate: zDate.nullish().transform((v) => v ?? null),
  letter: optText(1).transform((v) => v?.toUpperCase() ?? null),
  pos: optInt,
  number: optInt,
  relatedDocumentId: z.number().int().positive().nullish().transform((v) => v ?? null),
  notes: optText(2000),
  tripIds: z.array(z.number().int().positive()).max(2000),
  items: z
    .array(
      z.object({
        date: zDate,
        description: z.string().trim().max(500),
        amount: z.number({ error: "Monto inválido" }).finite(),
      }),
    )
    .max(500),
});

export type DocumentInput = z.input<typeof documentSchema>;

function revalidate() {
  revalidatePath("/finanzas", "layout");
  revalidatePath("/contactos", "layout");
  revalidatePath("/");
}

/** Alta de comprobante: factura (ARCA), interno numerado, ND, NC, bonificación o saldo inicial. */
export async function createDocument(input: DocumentInput): Promise<ActionResult & { id?: number }> {
  const { user, error } = await checkPermission("finanzas");
  if (error) return error;
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const label = DOCUMENT_TYPE_LABELS[d.type];

  const ruleError = validateDocumentDraft(d);
  if (ruleError) return { ok: false, error: ruleError };

  const [client] = await db
    .select({ id: clients.id, paymentDays: clients.paymentDays })
    .from(clients)
    .where(eq(clients.id, d.clientId));
  if (!client) return { ok: false, error: "El cliente no existe." };

  if (d.relatedDocumentId != null && allowsRelated(d.type)) {
    const [rel] = await db
      .select({ clientId: documents.clientId })
      .from(documents)
      .where(and(eq(documents.id, d.relatedDocumentId), isNull(documents.voidedAt)));
    if (!rel || rel.clientId !== d.clientId) {
      return { ok: false, error: "El comprobante relacionado no existe, está anulado o es de otro cliente." };
    }
  }

  // Ítems: recorridos (factura/interno) o los cargados a mano.
  let items: { tripId: number | null; date: string; description: string; amount: number }[];
  if (usesTrips(d.type)) {
    const rows = await db
      .select({
        id: trips.id,
        clientId: trips.clientId,
        date: trips.date,
        route: routes.name,
        routeText: trips.routeText,
        passengers: trips.passengers,
        capacity: trips.capacity,
        price: trips.price,
      })
      .from(trips)
      .leftJoin(routes, eq(routes.id, trips.routeId))
      .where(inArray(trips.id, d.tripIds))
      .orderBy(trips.date, trips.id);
    if (rows.length !== d.tripIds.length || rows.some((t) => t.clientId !== d.clientId)) {
      return { ok: false, error: "Hay recorridos que no existen o no son de este cliente." };
    }
    if (rows.some((t) => t.date < CC_START)) {
      return { ok: false, error: "Hay recorridos anteriores al inicio de la cuenta corriente (van por saldo inicial)." };
    }
    const taken = await tripsInActiveDocument(d.tripIds);
    if (taken.size) {
      const [tripId, info] = [...taken.entries()][0];
      const t = rows.find((r) => r.id === tripId)!;
      return { ok: false, error: `El recorrido del ${t.date.split("-").reverse().join("/")} ya está en ${info.label}.` };
    }
    items = rows.map((t) => ({ tripId: t.id, date: t.date, description: tripDescription(t), amount: t.price }));
  } else {
    items = d.items.map((i) => ({ tripId: null, ...i }));
  }

  const isInternal = d.type === "interno";
  const values = {
    type: d.type,
    clientId: d.clientId,
    date: d.date,
    // Factura/interno guardan su vencimiento (por defecto fecha + días de pago del cliente).
    dueDate: hasDueDate(d.type) ? (d.dueDate ?? (usesTrips(d.type) ? addDays(d.date, client.paymentDays) : null)) : null,
    letter: isInternal ? "X" : d.letter,
    pos: isInternal ? 1 : d.pos,
    number: d.number,
    amount: itemsTotal(items),
    relatedDocumentId: allowsRelated(d.type) ? d.relatedDocumentId : null,
    // NC/bonificación/ND sin observación: el detalle de sus ítems queda como observación (se ve en el estado de cuenta).
    notes:
      d.notes ??
      (usesSingleAmount(d.type) || d.type === "nota_debito"
        ? items.map((i) => i.description).join("; ").slice(0, 2000)
        : null),
  };

  let id: number | undefined;
  let number = values.number;
  for (let attempt = 0; id === undefined; attempt++) {
    if (isInternal) number = await nextInternalNumber();
    try {
      [{ id }] = await db
        .insert(documents)
        .values({ ...values, number, ...created(user.id) })
        .returning({ id: documents.id });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // Interno: otro alta tomó el mismo número; se reintenta una vez con el siguiente.
      if (isInternal && attempt === 0) continue;
      return {
        ok: false,
        error: `Ya existe ${label.toLowerCase()} ${formatDocNumber(values.letter, values.pos, number)}.`,
      };
    }
  }
  try {
    await db.insert(documentItems).values(items.map((i) => ({ ...i, documentId: id! })));
  } catch (e) {
    await db.delete(documents).where(eq(documents.id, id));
    throw e;
  }

  revalidate();
  const num = formatDocNumber(values.letter, values.pos, number);
  return { ok: true, id, message: `Comprobante registrado: ${label}${num ? ` ${num}` : ""}` };
}

const voidSchema = z.object({ reason: z.string().max(500, "El motivo no puede superar los 500 caracteres").optional() });

/** Anula un comprobante (no se borra; el número no se reutiliza y sus recorridos quedan libres). */
export async function voidDocument(id: number, formData: FormData): Promise<ActionResult> {
  const { user, error } = await checkPermission("finanzas");
  if (error) return error;
  const parsed = voidSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const voided = await db
    .update(documents)
    .set({ voidedAt: new Date(), voidedReason: parsed.data.reason ?? null, ...updated(user.id) })
    .where(and(eq(documents.id, id), isNull(documents.voidedAt)))
    .returning({ id: documents.id });
  if (voided.length === 0) return { ok: false, error: "El comprobante no existe o ya está anulado." };
  revalidate();
  return { ok: true, message: "Comprobante anulado" };
}

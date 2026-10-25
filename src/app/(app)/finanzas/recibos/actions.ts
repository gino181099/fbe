"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { receiptTrips, receipts } from "@/db/schema";
import { CC_START } from "@/lib/constants";
import { created, updated } from "@/lib/audit";
import { isUniqueViolation } from "@/lib/db-errors";
import { formatReceiptNumber } from "@/lib/doc-number";
import { formatDate } from "@/lib/format";
import { firstError, formToObject, zDate } from "@/lib/forms";
import { receiptAllocationError } from "@/lib/ledger";
import { type ActionResult, checkPermission } from "@/lib/permissions";
import { getPendingTrips, nextReceiptNumber } from "@/lib/receipts";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .nullish()
    .transform((v) => (v ? v : null));

const receiptSchema = z.object({
  clientId: z.number({ error: "Elegí un cliente" }).int().positive({ error: "Elegí un cliente" }),
  date: zDate.refine((d) => d >= CC_START, `La fecha no puede ser anterior al ${formatDate(CC_START)}`),
  amount: z.number({ error: "Monto inválido" }).finite({ error: "Monto inválido" }),
  method: optText(100),
  notes: optText(2000),
  trips: z
    .array(
      z.object({
        tripId: z.number({ error: "Recorrido inválido" }).int({ error: "Recorrido inválido" }).positive({ error: "Recorrido inválido" }),
        amount: z.number({ error: "Importe inválido" }).finite({ error: "Importe inválido" }),
      }),
    )
    .max(2000, "Demasiados recorridos"),
});

export type ReceiptInput = z.input<typeof receiptSchema>;

function revalidate() {
  revalidatePath("/finanzas", "layout");
  revalidatePath("/contactos", "layout");
  revalidatePath("/");
}

/** Alta de recibo numerado: monto libre y/o recorridos tildados (asignaciones antes del FIFO). */
export async function createReceipt(input: ReceiptInput): Promise<ActionResult & { id?: number }> {
  const { user, error } = await checkPermission("finanzas");
  if (error) return error;
  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const amount = Math.round(d.amount * 100) / 100;
  const allocations = d.trips.map((t) => ({ tripId: t.tripId, amount: Math.round(t.amount * 100) / 100 }));

  // Pendientes recalculados en el servidor: solo recorridos del cliente, desde el corte y con saldo.
  const pending = await getPendingTrips(d.clientId);
  if (!pending) return { ok: false, error: "El cliente no existe." };
  const ruleError = receiptAllocationError(amount, allocations, pending.pending);
  if (ruleError) return { ok: false, error: ruleError };

  const values = { clientId: d.clientId, date: d.date, amount, method: d.method, notes: d.notes };
  let id: number | undefined;
  let number = 0;
  for (let attempt = 0; id === undefined; attempt++) {
    number = await nextReceiptNumber();
    try {
      [{ id }] = await db
        .insert(receipts)
        .values({ ...values, number, ...created(user.id) })
        .returning({ id: receipts.id });
    } catch (e) {
      // Otro alta tomó el mismo número: se reintenta una vez con el siguiente.
      if (isUniqueViolation(e) && attempt === 0) continue;
      throw e;
    }
  }
  if (allocations.length) {
    try {
      await db.insert(receiptTrips).values(allocations.map((a) => ({ ...a, receiptId: id! })));
    } catch (e) {
      await db.delete(receipts).where(eq(receipts.id, id));
      throw e;
    }
  }

  revalidate();
  return { ok: true, id, message: `Recibo ${formatReceiptNumber(number)} registrado` };
}

const voidSchema = z.object({ reason: z.string().max(500, "El motivo no puede superar los 500 caracteres").optional() });

/** Anula un recibo (no se borra; el número no se reutiliza y sus recorridos quedan libres). */
export async function voidReceipt(id: number, formData: FormData): Promise<ActionResult> {
  const { user, error } = await checkPermission("finanzas");
  if (error) return error;
  const parsed = voidSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const voided = await db
    .update(receipts)
    .set({ voidedAt: new Date(), voidedReason: parsed.data.reason?.trim() || null, ...updated(user.id) })
    .where(and(eq(receipts.id, id), isNull(receipts.voidedAt)))
    .returning({ number: receipts.number });
  if (voided.length === 0) return { ok: false, error: "El recibo no existe o ya está anulado." };
  revalidate();
  return { ok: true, message: `Recibo ${formatReceiptNumber(voided[0].number)} anulado` };
}

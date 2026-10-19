import "server-only";
import { type SQL, and, desc, eq, gte, inArray, isNotNull, isNull, lte, max, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, documentItems, documents, routes, trips } from "@/db/schema";
import { CC_START, type DocumentType } from "./constants";
import { formatDocNumber } from "./doc-number";

const GROUPING: DocumentType[] = ["factura", "interno"];

export type DocumentFilters = {
  type?: DocumentType;
  clientId?: number;
  from?: string;
  to?: string;
  /** vigentes (por defecto) | anulados | todos */
  status?: "vigentes" | "anulados" | "todos";
};

/** Comprobantes con su cliente, más nuevos primero. */
export async function listDocuments(f: DocumentFilters, limit = 500) {
  const where: SQL[] = [];
  if (f.type) where.push(eq(documents.type, f.type));
  if (f.clientId) where.push(eq(documents.clientId, f.clientId));
  if (f.from) where.push(gte(documents.date, f.from));
  if (f.to) where.push(lte(documents.date, f.to));
  const status = f.status ?? "vigentes";
  if (status === "vigentes") where.push(isNull(documents.voidedAt));
  if (status === "anulados") where.push(isNotNull(documents.voidedAt));
  return db
    .select({ d: documents, clientName: clients.name })
    .from(documents)
    .innerJoin(clients, eq(clients.id, documents.clientId))
    .where(and(...where))
    .orderBy(desc(documents.date), desc(documents.id))
    .limit(limit);
}

/** Comprobante con ítems y cliente (null si no existe). */
export async function getDocument(id: number) {
  const [row] = await db
    .select({ d: documents, client: clients })
    .from(documents)
    .innerJoin(clients, eq(clients.id, documents.clientId))
    .where(eq(documents.id, id));
  if (!row) return null;
  const items = await db
    .select()
    .from(documentItems)
    .where(eq(documentItems.documentId, id))
    .orderBy(documentItems.date, documentItems.id);
  return { ...row.d, client: row.client, items };
}

/** Hay un ítem de factura/interno vigente para el recorrido `t`. */
const inActiveGroupingDocument = (tripId: typeof trips.id) =>
  db
    .select({ one: sql`1` })
    .from(documentItems)
    .innerJoin(documents, eq(documents.id, documentItems.documentId))
    .where(
      and(eq(documentItems.tripId, tripId), isNull(documents.voidedAt), inArray(documents.type, GROUPING)),
    );

/** Recorridos del cliente desde el corte (y en el período) sin factura/interno vigente. */
export async function getUninvoicedTrips(clientId: number, from?: string, to?: string) {
  const start = from && from > CC_START ? from : CC_START;
  return db
    .select({
      id: trips.id,
      date: trips.date,
      route: routes.name,
      routeText: trips.routeText,
      passengers: trips.passengers,
      capacity: trips.capacity,
      price: trips.price,
    })
    .from(trips)
    .leftJoin(routes, eq(routes.id, trips.routeId))
    .where(
      and(
        eq(trips.clientId, clientId),
        gte(trips.date, start),
        to ? lte(trips.date, to) : undefined,
        notExists(inActiveGroupingDocument(trips.id)),
      ),
    )
    .orderBy(trips.date, trips.id);
}

/** Próximo número de comprobante interno: máximo (incluye anulados, nunca se reutiliza) + 1. */
export async function nextInternalNumber() {
  const [row] = await db
    .select({ n: max(documents.number) })
    .from(documents)
    .where(eq(documents.type, "interno"));
  return (row?.n ?? 0) + 1;
}

/**
 * Recorridos (de los pedidos) que ya están en un factura/interno vigente: tripId → comprobante.
 * `label` completa "Está en …" ("el comprobante X 0001-00000003: anulalo primero").
 */
export async function tripsInActiveDocument(tripIds: number[]) {
  const map = new Map<number, { id: number; type: DocumentType; label: string }>();
  if (tripIds.length === 0) return map;
  const rows = await db
    .select({
      tripId: documentItems.tripId,
      id: documents.id,
      type: documents.type,
      letter: documents.letter,
      pos: documents.pos,
      number: documents.number,
    })
    .from(documentItems)
    .innerJoin(documents, eq(documents.id, documentItems.documentId))
    .where(
      and(
        inArray(documentItems.tripId, tripIds),
        isNull(documents.voidedAt),
        inArray(documents.type, GROUPING),
      ),
    );
  for (const r of rows) {
    if (r.tripId == null) continue;
    const num = formatDocNumber(r.letter, r.pos, r.number);
    const label = r.type === "factura" ? `la factura ${num}: anulala primero` : `el comprobante ${num}: anulalo primero`;
    map.set(r.tripId, { id: r.id, type: r.type, label });
  }
  return map;
}

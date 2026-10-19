import "server-only";
import {
  type AnyColumn,
  type SQL,
  and,
  count,
  eq,
  gte,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  collections,
  documentItems,
  documents,
  routes,
  trips,
} from "@/db/schema";
import { CC_START, type DocumentType } from "./constants";
import {
  type LedgerDocument,
  type LedgerLine,
  buildLedger,
  statementFromLedger,
} from "./ledger";

export const sumOf = (col: AnyColumn) =>
  sql<number>`coalesce(sum(${col}), 0)`.mapWith(Number);

const sumWhere = (col: AnyColumn, cond: SQL) =>
  sql<number>`coalesce(sum(${col}) filter (where ${cond}), 0)`.mapWith(Number);

/** Suma de cobranzas desde el corte filtrada por tipo (cobro / ajuste). */
const sumOfKind = (kind: "cobro" | "ajuste") =>
  sumWhere(collections.amount, sql`${collections.kind} = ${kind}`);

const sumOfDocs = (...types: DocumentType[]) =>
  sumWhere(documents.amount, inArray(documents.type, types));

type Balance = {
  billed: number;
  collected: number;
  adjusted: number;
  balance: number;
  trips: number;
};

/**
 * Cuenta corriente por cliente desde el corte (CC_START): billed = recorridos + ND + saldo inicial;
 * collected = cobros; adjusted = ajustes + NC + bonificación. `trips` = conteo histórico total.
 * Factura/interno no suman; los comprobantes anulados no cuentan.
 */
export async function getBalances() {
  const [tripRows, docRows, collectionRows] = await Promise.all([
    db
      .select({
        clientId: trips.clientId,
        total: sumWhere(trips.price, gte(trips.date, CC_START)),
        trips: count(),
      })
      .from(trips)
      .groupBy(trips.clientId),
    db
      .select({
        clientId: documents.clientId,
        debits: sumOfDocs("nota_debito", "saldo_inicial"),
        credits: sumOfDocs("nota_credito", "bonificacion"),
      })
      .from(documents)
      // Solo el saldo inicial cuenta aunque sea anterior al corte.
      .where(
        and(
          isNull(documents.voidedAt),
          or(
            eq(documents.type, "saldo_inicial"),
            gte(documents.date, CC_START),
          ),
        ),
      )
      .groupBy(documents.clientId),
    db
      .select({
        clientId: collections.clientId,
        cobros: sumOfKind("cobro"),
        ajustes: sumOfKind("ajuste"),
      })
      .from(collections)
      .where(gte(collections.date, CC_START))
      .groupBy(collections.clientId),
  ]);
  const map = new Map<number, Balance>();
  const entry = (clientId: number) => {
    let e = map.get(clientId);
    if (!e)
      map.set(
        clientId,
        (e = { billed: 0, collected: 0, adjusted: 0, balance: 0, trips: 0 }),
      );
    return e;
  };
  for (const t of tripRows) {
    const e = entry(t.clientId);
    e.billed += t.total;
    e.trips = t.trips;
  }
  for (const d of docRows) {
    const e = entry(d.clientId);
    e.billed += d.debits;
    e.adjusted += d.credits;
  }
  for (const c of collectionRows) {
    const e = entry(c.clientId);
    e.collected += c.cobros;
    e.adjusted += c.ajustes;
  }
  for (const e of map.values())
    e.balance = Math.round((e.billed - e.collected - e.adjusted) * 100) / 100;
  return map;
}

export type StatementLine = LedgerLine;

/** Comprobantes vigentes del cliente (con ítems), en la forma que usa el ledger. */
async function getLedgerDocuments(clientId: number): Promise<LedgerDocument[]> {
  const where = and(
    eq(documents.clientId, clientId),
    isNull(documents.voidedAt),
  );
  const [docRows, itemRows] = await Promise.all([
    db
      .select()
      .from(documents)
      .where(where)
      .orderBy(documents.date, documents.id),
    db
      .select({
        documentId: documentItems.documentId,
        tripId: documentItems.tripId,
        date: documentItems.date,
        description: documentItems.description,
        amount: documentItems.amount,
      })
      .from(documentItems)
      .innerJoin(documents, eq(documents.id, documentItems.documentId))
      .where(where)
      .orderBy(documentItems.id),
  ]);
  return docRows.map((d) => ({
    ...d,
    items: itemRows.filter((i) => i.documentId === d.id),
  }));
}

/**
 * Estado de cuenta de un cliente entre dos fechas (inclusive) con el modelo de cuenta corriente.
 * Si `from` es anterior al corte se toma el corte (saldo anterior 0); `from` devuelto es el efectivo.
 * El ledger se arma con todo (las líneas se filtran por período); `debits` y `balance` son a la fecha
 * de hoy con todo lo cargado (pendientes de cobro). Factura/interno van como líneas informativas.
 */
export async function getStatement(clientId: number, from: string, to: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId));
  if (!client) return null;

  const [tripRows, documentRows, collectionRows] = await Promise.all([
    db
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
        and(eq(trips.clientId, clientId), gte(trips.date, CC_START)),
      )
      .orderBy(trips.date, trips.id),
    getLedgerDocuments(clientId),
    db
      .select()
      .from(collections)
      .where(
        and(eq(collections.clientId, clientId), gte(collections.date, CC_START)),
      )
      .orderBy(collections.date, collections.id),
  ]);

  const ledger = buildLedger({
    trips: tripRows,
    documents: documentRows,
    collections: collectionRows,
    paymentDays: client.paymentDays,
  });
  return {
    client,
    to,
    ...statementFromLedger(ledger, from, to),
    debits: ledger.debits,
    unappliedCredit: ledger.unappliedCredit,
    currentBalance: ledger.balance,
  };
}

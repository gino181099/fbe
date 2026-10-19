// Cuenta corriente (lógica pura, sin base): movimientos con saldo corrido, aplicación FIFO de créditos
// y estado de cuenta por período. Ver reglas en specs/MEMORIA.md.
import {
  CC_START,
  type CollectionKind,
  type DocumentType,
  type MovementKind,
} from "./constants";
import { formatDocNumber, formatReceiptNumber } from "./doc-number";

export type LedgerTrip = {
  id: number;
  date: string;
  route: string | null;
  routeText: string | null;
  passengers: number | null;
  capacity: number | null;
  price: number;
};

export type LedgerDocumentItem = {
  tripId: number | null;
  date: string;
  description: string;
  amount: number;
};

export type LedgerDocument = {
  id: number;
  type: DocumentType;
  letter: string | null;
  pos: number | null;
  number: number | null;
  date: string;
  dueDate: string | null;
  amount: number;
  notes: string | null;
  voidedAt: Date | string | null;
  items: LedgerDocumentItem[];
};

export type LedgerCollection = {
  id: number;
  date: string;
  kind: CollectionKind;
  method: string | null;
  notes: string | null;
  amount: number;
};

/** Recibo numerado (T-019) con sus recorridos tildados (asignaciones explícitas). */
export type LedgerReceipt = {
  id: number;
  number: number;
  date: string;
  method: string | null;
  notes: string | null;
  amount: number;
  voidedAt: Date | string | null;
  trips: { tripId: number; amount: number }[];
};

/** Origen de un crédito: cobro/ajuste (`collection`), comprobante NC/bonificación (`document`) o recibo. */
export type CreditRef = { source: "collection" | "document" | "receipt"; id: number };

/** Asignación explícita de un crédito a un recorrido (se aplica antes del FIFO). */
export type Allocation = { credit: CreditRef; tripId: number; amount: number };

export type LedgerInput = {
  trips: LedgerTrip[];
  documents: LedgerDocument[];
  collections: LedgerCollection[];
  /** Recibos vigentes; sus `trips` se aplican como asignaciones explícitas. Los anulados no cuentan. */
  receipts?: LedgerReceipt[];
  allocations?: Allocation[];
  paymentDays: number;
  cutoff?: string;
};

export type LedgerLine = {
  date: string;
  kind: MovementKind;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export type DebitStatus = "pendiente" | "parcial" | "cancelado";

export type LedgerDebit = {
  key: string;
  kind: "recorrido" | "nota_debito" | "saldo_inicial";
  tripId: number | null;
  documentId: number | null;
  date: string;
  description: string;
  amount: number;
  paid: number;
  remaining: number;
  status: DebitStatus;
  dueDate: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const EPS = 0.005;

/** Comprobante vigente (no anulado). */
export const isActiveDocument = (d: { voidedAt: Date | string | null }) =>
  d.voidedAt == null;

/** Solo comprobantes vigentes. */
export const activeDocuments = <T extends { voidedAt: Date | string | null }>(
  docs: T[],
) => docs.filter(isActiveDocument);

const GROUPING_TYPES: DocumentType[] = ["factura", "interno"];

/**
 * Recorridos ya incluidos en un comprobante factura|interno vigente: tripId → id del comprobante.
 * Sirve para validar que un recorrido esté en un solo comprobante (excluyendo el que se edita).
 */
export function tripsInActiveDocuments(
  docs: {
    id: number;
    type: DocumentType;
    voidedAt: Date | string | null;
    items: { tripId: number | null }[];
  }[],
  excludeDocumentId?: number,
) {
  const map = new Map<number, number>();
  for (const d of activeDocuments(docs)) {
    if (!GROUPING_TYPES.includes(d.type) || d.id === excludeDocumentId)
      continue;
    for (const it of d.items) if (it.tripId != null) map.set(it.tripId, d.id);
  }
  return map;
}

/** Suma `days` días a una fecha "YYYY-MM-DD" (sin zonas horarias). */
export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "A 0001-00000012" (lo que haya de letra, punto de venta y número). */
export function documentNumber(
  d: Pick<LedgerDocument, "letter" | "pos" | "number">,
) {
  return formatDocNumber(d.letter, d.pos, d.number);
}

export function tripDescription(
  t: Pick<LedgerTrip, "route" | "routeText" | "capacity" | "passengers">,
) {
  return [
    t.route ?? t.routeText ?? "Recorrido",
    t.capacity ? `(${t.capacity} plazas)` : null,
    t.passengers ? `· ${t.passengers} pax` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function documentDescription(d: LedgerDocument, label: string) {
  return [label, documentNumber(d) || null, d.notes ? `– ${d.notes}` : null]
    .filter(Boolean)
    .join(" ");
}

function collectionDescription(c: LedgerCollection) {
  return (
    c.kind === "ajuste"
      ? ["Ajuste", c.notes ? `– ${c.notes}` : null]
      : [
          "Cobro",
          c.method ? `(${c.method})` : null,
          c.notes ? `– ${c.notes}` : null,
        ]
  )
    .filter(Boolean)
    .join(" ");
}

function receiptDescription(r: LedgerReceipt) {
  return [
    "Recibo",
    formatReceiptNumber(r.number),
    r.method ? `(${r.method})` : null,
    r.notes ? `– ${r.notes}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

// Orden en el mismo día: saldo inicial → débitos (y factura/interno informativos) → créditos.
const rank = (kind: MovementKind) =>
  kind === "saldo_inicial"
    ? 0
    : kind === "recorrido" ||
        kind === "nota_debito" ||
        kind === "factura" ||
        kind === "interno"
      ? 1
      : 2;

const DOC_LABELS: Partial<Record<DocumentType, string>> = {
  factura: "Factura",
  interno: "Comprobante interno",
  nota_debito: "Nota de débito",
  nota_credito: "Nota de crédito",
  bonificacion: "Bonificación",
};

/**
 * Arma la cuenta corriente desde el corte: líneas ordenadas con saldo corrido (desde 0), débitos con
 * lo aplicado (asignaciones explícitas y luego FIFO a lo más viejo) y el sobrante de créditos (saldo a favor).
 * Factura/interno no mueven saldo (línea informativa sin importe; dan vencimiento a sus recorridos);
 * los anulados no cuentan.
 */
export function buildLedger(input: LedgerInput) {
  const cutoff = input.cutoff ?? CC_START;
  const docs = activeDocuments(input.documents);
  const trips = input.trips.filter((t) => t.date >= cutoff);
  const collections = input.collections.filter((c) => c.date >= cutoff);
  const receipts = (input.receipts ?? []).filter(
    (r) => r.voidedAt == null && r.date >= cutoff,
  );

  // Vencimiento por recorrido según el comprobante factura/interno vigente que lo incluye.
  const tripDue = new Map<number, string>();
  for (const d of docs) {
    if (!GROUPING_TYPES.includes(d.type)) continue;
    const due = d.dueDate ?? addDays(d.date, input.paymentDays);
    for (const it of d.items)
      if (it.tripId != null) tripDue.set(it.tripId, due);
  }

  type Move = Omit<LedgerLine, "balance"> & { order: number };
  const moves: Move[] = [];
  const debits: Omit<LedgerDebit, "paid" | "remaining" | "status">[] = [];
  const credits: { ref: CreditRef; date: string; amount: number }[] = [];
  let order = 0;

  for (const d of docs.filter((d) => d.type === "saldo_inicial")) {
    const label = ["Saldo inicial", d.notes ? `– ${d.notes}` : null]
      .filter(Boolean)
      .join(" ");
    moves.push({
      date: d.date < cutoff ? cutoff : d.date,
      kind: "saldo_inicial",
      description: label,
      debit: d.amount,
      credit: 0,
      order: order++,
    });
    // Para FIFO/vencimiento cuenta cada ítem con su fecha (sin ítems: el total en la fecha del documento).
    const items = d.items.length
      ? d.items
      : [{ tripId: null, date: d.date, description: label, amount: d.amount }];
    items.forEach((it, i) =>
      debits.push({
        key: `saldo_inicial:${d.id}:${i}`,
        kind: "saldo_inicial",
        tripId: null,
        documentId: d.id,
        date: it.date,
        description: it.description,
        amount: it.amount,
        dueDate: d.dueDate ?? addDays(it.date, input.paymentDays),
      }),
    );
  }
  for (const t of trips) {
    const description = tripDescription(t);
    moves.push({
      date: t.date,
      kind: "recorrido",
      description,
      debit: t.price,
      credit: 0,
      order: order++,
    });
    debits.push({
      key: `trip:${t.id}`,
      kind: "recorrido",
      tripId: t.id,
      documentId: null,
      date: t.date,
      description,
      amount: t.price,
      dueDate: tripDue.get(t.id) ?? addDays(t.date, input.paymentDays),
    });
  }
  for (const d of docs) {
    // Solo el saldo inicial cuenta aunque sea anterior al corte.
    if (d.date < cutoff) continue;
    if (GROUPING_TYPES.includes(d.type)) {
      // Línea informativa: documenta recorridos ya contados (no mueve el saldo).
      const n = d.items.filter((it) => it.tripId != null).length;
      moves.push({
        date: d.date,
        kind: d.type as "factura" | "interno",
        description: [
          DOC_LABELS[d.type],
          documentNumber(d) || null,
          `· ${n} ${n === 1 ? "recorrido" : "recorridos"}`,
          d.notes ? `– ${d.notes}` : null,
        ]
          .filter(Boolean)
          .join(" "),
        debit: 0,
        credit: 0,
        order: order++,
      });
    } else if (d.type === "nota_debito") {
      const description = documentDescription(d, DOC_LABELS.nota_debito!);
      moves.push({
        date: d.date,
        kind: "nota_debito",
        description,
        debit: d.amount,
        credit: 0,
        order: order++,
      });
      debits.push({
        key: `document:${d.id}`,
        kind: "nota_debito",
        tripId: null,
        documentId: d.id,
        date: d.date,
        description,
        amount: d.amount,
        dueDate: d.dueDate ?? addDays(d.date, input.paymentDays),
      });
    } else if (d.type === "nota_credito" || d.type === "bonificacion") {
      moves.push({
        date: d.date,
        kind: d.type,
        description: documentDescription(d, DOC_LABELS[d.type]!),
        debit: 0,
        credit: d.amount,
        order: order++,
      });
      credits.push({
        ref: { source: "document", id: d.id },
        date: d.date,
        amount: d.amount,
      });
    }
  }
  for (const c of collections) {
    moves.push({
      date: c.date,
      kind: c.kind,
      description: collectionDescription(c),
      debit: 0,
      credit: c.amount,
      order: order++,
    });
    credits.push({
      ref: { source: "collection", id: c.id },
      date: c.date,
      amount: c.amount,
    });
  }
  for (const r of receipts) {
    moves.push({
      date: r.date,
      kind: "recibo",
      description: receiptDescription(r),
      debit: 0,
      credit: r.amount,
      order: order++,
    });
    credits.push({
      ref: { source: "receipt", id: r.id },
      date: r.date,
      amount: r.amount,
    });
  }
  // Recorridos tildados en recibos vigentes: asignaciones explícitas (antes del FIFO).
  const allocations: Allocation[] = [
    ...receipts.flatMap((r) =>
      r.trips.map((t) => ({
        credit: { source: "receipt" as const, id: r.id },
        tripId: t.tripId,
        amount: t.amount,
      })),
    ),
    ...(input.allocations ?? []),
  ];

  moves.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      rank(a.kind) - rank(b.kind) ||
      a.order - b.order,
  );
  let running = 0;
  const lines: LedgerLine[] = moves.map((m) => {
    running = round2(running + m.debit - m.credit);
    return {
      date: m.date,
      kind: m.kind,
      description: m.description,
      debit: m.debit,
      credit: m.credit,
      balance: running,
    };
  });

  // Aplicación de créditos: primero asignaciones explícitas, después el resto a lo más viejo.
  const sortedDebits = debits
    .map((d, i) => ({ ...d, i, paid: 0 }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.kind === "saldo_inicial" ? 0 : 1) -
          (b.kind === "saldo_inicial" ? 0 : 1) ||
        a.i - b.i,
    );
  const creditLeft = new Map(
    credits.map((c) => [`${c.ref.source}:${c.ref.id}`, c.amount]),
  );
  for (const a of allocations) {
    const key = `${a.credit.source}:${a.credit.id}`;
    const left = creditLeft.get(key) ?? 0;
    const debit = sortedDebits.find((d) => d.tripId === a.tripId);
    if (!debit || left <= EPS) continue;
    const applied = round2(Math.min(a.amount, left, debit.amount - debit.paid));
    if (applied <= EPS) continue;
    debit.paid = round2(debit.paid + applied);
    creditLeft.set(key, round2(left - applied));
  }
  // El FIFO a lo más viejo no depende del orden de los créditos: se aplica el total disponible.
  let pool = round2([...creditLeft.values()].reduce((s, v) => s + v, 0));
  for (const d of sortedDebits) {
    if (pool <= EPS) break;
    const applied = round2(Math.min(pool, d.amount - d.paid));
    if (applied <= EPS) continue;
    d.paid = round2(d.paid + applied);
    pool = round2(pool - applied);
  }

  const ledgerDebits: LedgerDebit[] = sortedDebits.map((d) => {
    const remaining = round2(d.amount - d.paid);
    const status: DebitStatus =
      remaining <= EPS ? "cancelado" : d.paid > EPS ? "parcial" : "pendiente";
    const {
      key,
      kind,
      tripId,
      documentId,
      date,
      description,
      amount,
      paid,
      dueDate,
    } = d;
    return {
      key,
      kind,
      tripId,
      documentId,
      date,
      description,
      amount,
      paid,
      remaining,
      status,
      dueDate,
    };
  });

  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  return {
    cutoff,
    lines,
    debits: ledgerDebits,
    // Créditos sin aplicar (saldo a favor del cliente).
    unappliedCredit: pool,
    totalDebit,
    totalCredit,
    balance: running,
  };
}

export type Ledger = ReturnType<typeof buildLedger>;

/**
 * Estado de cuenta entre `from` y `to` (inclusive) a partir del ledger. Si `from` es anterior al corte se
 * toma el corte (saldo anterior 0). Devuelve el `from` efectivo.
 */
export function statementFromLedger(ledger: Ledger, from: string, to: string) {
  const effectiveFrom = from < ledger.cutoff ? ledger.cutoff : from;
  const before = ledger.lines.filter((l) => l.date < effectiveFrom);
  const opening = before.length ? before[before.length - 1].balance : 0;
  const lines = ledger.lines.filter(
    (l) => l.date >= effectiveFrom && l.date <= to,
  );
  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  return {
    from: effectiveFrom,
    opening,
    lines,
    totalDebit,
    totalCredit,
    // Solo plata recibida (cobros y recibos; sin ajustes ni notas de crédito): "Cobrado en el período".
    totalCollected: round2(
      lines.reduce(
        (s, l) =>
          s + (l.kind === "cobro" || l.kind === "recibo" ? l.credit : 0),
        0,
      ),
    ),
    closing: round2(opening + totalDebit - totalCredit),
  };
}

/** Recorridos con saldo pendiente en el ledger: tripId → pendiente (solo recorridos desde el corte). */
export function pendingTripAmounts(ledger: Pick<Ledger, "debits">) {
  const map = new Map<number, number>();
  for (const d of ledger.debits)
    if (d.kind === "recorrido" && d.tripId != null && d.remaining > EPS)
      map.set(d.tripId, d.remaining);
  return map;
}

/**
 * Valida las asignaciones de un recibo nuevo contra los pendientes actuales: monto > 0, recorridos
 * pendientes del cliente (≥ corte), cada asignación entre 0 y su pendiente, sin repetir, y Σ ≤ monto.
 */
export function receiptAllocationError(
  amount: number,
  allocations: { tripId: number; amount: number }[],
  pending: Map<number, number>,
): string | null {
  if (!(amount > EPS)) return "El monto debe ser mayor a 0.";
  const seen = new Set<number>();
  for (const a of allocations) {
    if (seen.has(a.tripId)) return "Hay recorridos repetidos.";
    seen.add(a.tripId);
    const left = pending.get(a.tripId);
    if (left == null)
      return "Hay recorridos que no están pendientes de cobro, no son del cliente o son anteriores al inicio de la cuenta corriente.";
    if (!(a.amount > EPS)) return "El importe de cada recorrido debe ser mayor a 0.";
    if (a.amount > left + EPS)
      return "El importe de un recorrido supera su pendiente (puede haber cambiado: recargá la página).";
  }
  const total = round2(allocations.reduce((s, a) => s + a.amount, 0));
  if (total > amount + EPS)
    return "El monto del recibo no puede ser menor que la suma de los recorridos tildados.";
  return null;
}

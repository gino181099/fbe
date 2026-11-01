import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";
import {
  ACTIVITY_TYPES,
  CLIENT_TYPES,
  COLLECTION_KINDS,
  DOCUMENT_TYPES,
  EXPENSE_CATEGORIES,
  EXPENSE_SCOPES,
  LEAD_STAGES,
  OPPORTUNITY_STAGES,
  VOUCHER_TYPES,
} from "@/lib/constants";

// Montos en pesos: numeric(14,2) leído como number en JS.
const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });

// Auditoría (T-025): quién creó y quién modificó por última vez. Las acciones los completan con `audit.ts`.
const userRef = (name: string) => text(name).references((): AnyPgColumn => users.id, { onDelete: "set null" });
const audited = () => ({ createdBy: userRef("created_by"), updatedBy: userRef("updated_by") });
/** Para tablas sin `updated_at`: null = nunca se modificó. */
const updatedAtCol = () => timestamp("updated_at", { mode: "date" });

/* ─────────────────────────── Auth y permisos ─────────────────────────── */

export const userStatus = pgEnum("user_status", ["pending", "active", "disabled"]);

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // Login con usuario y contraseña (solo el admin local por ahora).
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  status: userStatus("status").notNull().default("pending"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const MODULES = ["contactos", "leads", "ventas", "finanzas", "usuarios"] as const;
export type Module = (typeof MODULES)[number];
export const moduleEnum = pgEnum("module", MODULES);

export const LEVELS = ["none", "view", "edit"] as const;
export type Level = (typeof LEVELS)[number];
export const levelEnum = pgEnum("permission_level", LEVELS);

export const permissions = pgTable(
  "permission",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    module: moduleEnum("module").notNull(),
    level: levelEnum("level").notNull().default("none"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.module] })],
);

export { DEFAULT_FUEL_SUPPLIER, FUEL_SUPPLIERS } from "@/lib/constants";

/* ─────────────────────────────── Contactos ─────────────────────────────── */

export { CLIENT_TYPES, LEAD_STAGES } from "@/lib/constants";
export const clientType = pgEnum("client_type", CLIENT_TYPES);
export const CLIENT_STATUSES = ["activo", "potencial", "inactivo"] as const;
export const clientStatus = pgEnum("client_status", CLIENT_STATUSES);
// Etapa del embudo comercial (null = no pasó por el embudo). Se conserva después de "ganado".
export const leadStage = pgEnum("lead_stage", LEAD_STAGES);

export const clients = pgTable("client", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  type: clientType("type").notNull().default("especial"),
  status: clientStatus("status").notNull().default("activo"),
  cuit: text("cuit"),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  leadStage: leadStage("lead_stage"),
  website: text("website"),
  // Segmento comercial (bodegas_turismo, corporativo, ...), texto libre.
  segment: text("segment"),
  // alta | media | baja (LEAD_PRIORITIES).
  leadPriority: text("lead_priority"),
  // Días de plazo para pagar (vencimiento de recorridos sin comprobante).
  paymentDays: integer("payment_days").notNull().default(30),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  ...audited(),
});

// Historial de seguimiento de un contacto. auto=true: generada por el sistema/script, no se puede borrar.
export const clientNotes = pgTable(
  "client_note",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    text: text("text").notNull(),
    auto: boolean("auto").notNull().default(false),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("client_note_client_idx").on(t.clientId, t.date)],
);

/* ──────────────────────────────── Leads (CRM) ──────────────────────────────── */

export { OPPORTUNITY_STAGES } from "@/lib/constants";
export const opportunityStage = pgEnum("opportunity_stage", OPPORTUNITY_STAGES);

// Oportunidad comercial: un prospecto nuevo o una propuesta a un cliente existente (client_id).
// Los datos de la empresa viven en el lead; al ganarlo se crea o actualiza el cliente.
export const leads = pgTable(
  "lead",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    title: text("title").notNull(),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "restrict" }),
    company: text("company").notNull(),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    address: text("address"),
    segment: text("segment"),
    // alta | media | baja (LEAD_PRIORITIES).
    priority: text("priority"),
    stage: opportunityStage("stage").notNull().default("nuevo"),
    expectedAmount: money("expected_amount"),
    expectedClose: date("expected_close", { mode: "string" }),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    nextAction: text("next_action"),
    nextActionDate: date("next_action_date", { mode: "string" }),
    lostReason: text("lost_reason"),
    notes: text("notes"),
    // Fecha en que pasó a ganado/perdido (null si está abierta).
    closedAt: date("closed_at", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ...audited(),
  },
  (t) => [index("lead_stage_idx").on(t.stage), index("lead_client_idx").on(t.clientId)],
);

// Seguimiento de una oportunidad. auto=true: generada por el sistema (cambio de etapa), no se borra.
export const leadNotes = pgTable(
  "lead_note",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    text: text("text").notNull(),
    auto: boolean("auto").notNull().default(false),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("lead_note_lead_idx").on(t.leadId, t.date)],
);

// Catálogo de recorridos (Alta Montaña, Bodegas, ...).
export const routes = pgTable("route", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
});

// Tarifario de clientes recurrentes: precio por recorrido y categoría de
// vehículo (capacidad: 8, 14, 18 plazas) vigente entre dos fechas.
export const rates = pgTable(
  "rate",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    routeId: integer("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "restrict" }),
    capacity: integer("capacity").notNull(),
    price: money("price").notNull(),
    validFrom: date("valid_from", { mode: "string" }).notNull(),
    validTo: date("valid_to", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    createdBy: userRef("created_by"),
  },
  (t) => [index("rate_lookup_idx").on(t.clientId, t.routeId, t.capacity)],
);

/* ───────────────────────────────── Flota ───────────────────────────────── */

export const drivers = pgTable("driver", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  phone: text("phone"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: updatedAtCol(),
  ...audited(),
});

// El vehículo es solo un dato asociado: no define capacidad, tarifa ni precio del recorrido.
export const vehicles = pgTable(
  "vehicle",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // Patente normalizada (mayúsculas, sin espacios ni guiones).
    plate: text("plate").notNull(),
    model: text("model").notNull(),
    seats: integer("seats").notNull(),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: updatedAtCol(),
    ...audited(),
  },
  (t) => [uniqueIndex("vehicle_plate_idx").on(t.plate)],
);

/* ───────────────────────────────── Ventas ──────────────────────────────── */

export const trips = pgTable(
  "trip",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    date: date("date", { mode: "string" }).notNull(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    routeId: integer("route_id").references(() => routes.id, { onDelete: "restrict" }),
    // Descripción libre del recorrido para servicios especiales (ej. "San Juan").
    routeText: text("route_text"),
    passengers: integer("passengers"),
    // Categoría tarifaria usada (8 / 14 / 18); puede diferir de los pasajeros.
    capacity: integer("capacity"),
    rateId: integer("rate_id").references(() => rates.id, { onDelete: "set null" }),
    price: money("price").notNull().default(0),
    // Texto histórico del chofer (cuando no se pudo asociar a `driver_id`).
    driver: text("driver"),
    driverId: integer("driver_id").references(() => drivers.id, { onDelete: "restrict" }),
    vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "restrict" }),
    driverPay: money("driver_pay"),
    fuelPesos: money("fuel_pesos"),
    fuelLiters: numeric("fuel_liters", { precision: 10, scale: 2, mode: "number" }),
    // Estación donde se cargó el gasoil del recorrido (ej. "Axion Sarmiento").
    fuelSupplier: text("fuel_supplier"),
    extraPayments: money("extra_payments"),
    notes: text("notes"),
    legacySource: text("legacy_source"),
    legacyId: integer("legacy_id"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: updatedAtCol(),
    ...audited(),
  },
  (t) => [
    index("trip_date_idx").on(t.date),
    index("trip_client_idx").on(t.clientId),
    index("trip_driver_idx").on(t.driverId),
    index("trip_vehicle_idx").on(t.vehicleId),
    uniqueIndex("trip_legacy_idx").on(t.legacySource, t.legacyId),
  ],
);

/* ──────────────────────────────── Finanzas ─────────────────────────────── */

export { COLLECTION_KINDS } from "@/lib/constants";
// "cobro" = plata recibida; "ajuste" = descuenta saldo sin ser cobro (ej. saldo histórico).
export const collectionKind = pgEnum("collection_kind", COLLECTION_KINDS);

export const collections = pgTable(
  "collection",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    date: date("date", { mode: "string" }).notNull(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    amount: money("amount").notNull(),
    kind: collectionKind("kind").notNull().default("cobro"),
    method: text("method"),
    notes: text("notes"),
    // Origen de ajustes generados por script ("saldo-historico") y su mes "YYYY-MM"; null en cargas manuales.
    source: text("source"),
    period: text("period"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("collection_client_idx").on(t.clientId),
    uniqueIndex("collection_source_idx").on(t.clientId, t.source, t.period),
  ],
);

export { DOCUMENT_TYPES } from "@/lib/constants";
export const documentType = pgEnum("document_type", DOCUMENT_TYPES);

// Comprobante de cuenta corriente. Factura/interno agrupan recorridos (no mueven saldo).
// Anular = voided_at (no se borra ni se reutiliza el número); un anulado no cuenta y libera sus recorridos.
export const documents = pgTable(
  "document",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    type: documentType("type").notNull(),
    // A / B / C / X (validado en las acciones).
    letter: text("letter"),
    pos: integer("pos"),
    number: integer("number"),
    date: date("date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    // Σ ítems (lo garantizan las acciones).
    amount: money("amount").notNull(),
    relatedDocumentId: integer("related_document_id").references((): AnyPgColumn => documents.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    voidedAt: timestamp("voided_at", { mode: "date" }),
    voidedReason: text("voided_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: updatedAtCol(),
    ...audited(),
  },
  (t) => [
    // Nulos distintos: saldo inicial / bonificación sin número no chocan.
    uniqueIndex("document_number_idx").on(t.type, t.letter, t.pos, t.number),
    index("document_client_date_idx").on(t.clientId, t.date),
  ],
);

// Ítems de un comprobante. Solo factura/interno llevan trip_id; la unicidad "un recorrido en un solo
// comprobante vigente" se valida en las acciones (un índice no puede ver voided_at del padre).
export const documentItems = pgTable(
  "document_item",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tripId: integer("trip_id").references(() => trips.id, { onDelete: "restrict" }),
    date: date("date", { mode: "string" }).notNull(),
    description: text("description").notNull(),
    amount: money("amount").notNull(),
  },
  (t) => [index("document_item_document_idx").on(t.documentId), index("document_item_trip_idx").on(t.tripId)],
);

// Recibo numerado (X 0001-NNNNNNNN): pago de un cliente desde el corte. Anular = voided_at (el número no
// se reutiliza); un anulado no cuenta y libera sus recorridos.
export const receipts = pgTable(
  "receipt",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    number: integer("number").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    amount: money("amount").notNull(),
    method: text("method"),
    notes: text("notes"),
    voidedAt: timestamp("voided_at", { mode: "date" }),
    voidedReason: text("voided_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: updatedAtCol(),
    ...audited(),
  },
  (t) => [uniqueIndex("receipt_number_idx").on(t.number), index("receipt_client_date_idx").on(t.clientId, t.date)],
);

// Recorridos tildados en un recibo (asignación explícita antes del FIFO). Un recorrido puede tener
// asignaciones parciales de varios recibos: el tope lo da su pendiente (se valida en la acción).
export const receiptTrips = pgTable(
  "receipt_trip",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    receiptId: integer("receipt_id")
      .notNull()
      .references(() => receipts.id, { onDelete: "cascade" }),
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "restrict" }),
    amount: money("amount").notNull(),
  },
  (t) => [index("receipt_trip_receipt_idx").on(t.receiptId), index("receipt_trip_trip_idx").on(t.tripId)],
);

// Proveedor (T-021). Las estaciones se vinculan con trip.fuel_supplier / fuel_load.supplier por nombre.
export const suppliers = pgTable(
  "supplier",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    cuit: text("cuit"),
    // "Emite factura".
    invoices: boolean("invoices").notNull().default(true),
    // Rubro (texto libre con sugerencias SUPPLIER_CATEGORIES).
    category: text("category"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: updatedAtCol(),
    ...audited(),
  },
  // Único ignorando mayúsculas (la acción guarda el nombre sin espacios extremos).
  (t) => [uniqueIndex("supplier_name_idx").on(sql`lower(${t.name})`)],
);

// Pago a un proveedor: baja el saldo general (no se aplica a gastos puntuales). No es gasto en reportes.
export const supplierPayments = pgTable(
  "supplier_payment",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    date: date("date", { mode: "string" }).notNull(),
    amount: money("amount").notNull(),
    method: text("method"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: updatedAtCol(),
    ...audited(),
  },
  (t) => [index("supplier_payment_supplier_date_idx").on(t.supplierId, t.date)],
);

export { EXPENSE_CATEGORIES, EXPENSE_SCOPES, VOUCHER_TYPES } from "@/lib/constants";
export const expenseCategory = pgEnum("expense_category", EXPENSE_CATEGORIES);
export const expenseScope = pgEnum("expense_scope", EXPENSE_SCOPES);
export const expenseVoucherType = pgEnum("expense_voucher_type", VOUCHER_TYPES);

export const expenses = pgTable(
  "expense",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    date: date("date", { mode: "string" }).notNull(),
    // T-022: general de la empresa o de un vehículo (check: vehiculo ⇔ vehicle_id no nulo).
    scope: expenseScope("scope").notNull().default("general"),
    category: expenseCategory("category").notNull(),
    // Texto libre con sugerencias EXPENSE_SUBCATEGORIES.
    subcategory: text("subcategory"),
    // "Qué se hizo".
    concept: text("concept"),
    // "Para qué".
    purpose: text("purpose"),
    voucherType: expenseVoucherType("voucher_type").notNull().default("sin_comprobante"),
    voucherNumber: text("voucher_number"),
    // Histórico (texto libre): ya no se escribe; se muestra solo si no hay supplier_id.
    supplier: text("supplier"),
    // T-021: proveedor vinculado (el texto `supplier` queda como histórico) y si se pagó en el momento.
    supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "restrict" }),
    // false = "a pagar": suma al saldo del proveedor hasta que se registren pagos.
    paid: boolean("paid").notNull().default(true),
    amount: money("amount").notNull(),
    notes: text("notes"),
    vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "restrict" }),
    driverId: integer("driver_id").references(() => drivers.id, { onDelete: "restrict" }),
    legacySource: text("legacy_source"),
    legacyId: integer("legacy_id"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: updatedAtCol(),
    ...audited(),
  },
  (t) => [
    index("expense_date_idx").on(t.date),
    index("expense_vehicle_idx").on(t.vehicleId),
    index("expense_supplier_idx").on(t.supplierId),
    uniqueIndex("expense_legacy_idx").on(t.legacySource, t.legacyId),
    check("expense_scope_vehicle_check", sql`(${t.scope} = 'vehiculo') = (${t.vehicleId} is not null)`),
  ],
);

// Cargas de combustible no asociadas a un recorrido (consumo, no pago).
export const fuelLoads = pgTable(
  "fuel_load",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    date: date("date", { mode: "string" }).notNull(),
    pesos: money("pesos").notNull(),
    liters: numeric("liters", { precision: 10, scale: 2, mode: "number" }),
    supplier: text("supplier"),
    notes: text("notes"),
    legacyId: integer("legacy_id").unique(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: updatedAtCol(),
    ...audited(),
  },
);

/* ───────────────────────────────── Agenda ──────────────────────────────── */

export { ACTIVITY_TYPES } from "@/lib/constants";
export const activityType = pgEnum("activity_type", ACTIVITY_TYPES);

// Actividad de la agenda (como en Odoo): algo que alguien tiene que hacer para una fecha, opcionalmente
// vinculado a un contacto, oportunidad, vehículo o proveedor. Hecha = done_at (no se borra).
export const activities = pgTable(
  "activity",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    type: activityType("type").notNull().default("tarea"),
    title: text("title").notNull(),
    notes: text("notes"),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    assignedTo: text("assigned_to")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }),
    leadId: integer("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "cascade" }),
    supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "cascade" }),
    doneAt: timestamp("done_at", { mode: "date" }),
    doneBy: userRef("done_by"),
    doneNote: text("done_note"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: updatedAtCol(),
    ...audited(),
  },
  (t) => [
    index("activity_assigned_idx").on(t.assignedTo, t.doneAt, t.dueDate),
    index("activity_client_idx").on(t.clientId),
    index("activity_lead_idx").on(t.leadId),
    index("activity_vehicle_idx").on(t.vehicleId),
    index("activity_supplier_idx").on(t.supplierId),
  ],
);

/** Dispositivos con notificaciones activadas (Web Push, T-034): el resumen diario de la agenda. */
export const pushSubscriptions = pgTable(
  "push_subscription",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("push_subscription_endpoint_idx").on(t.endpoint), index("push_subscription_user_idx").on(t.userId)],
);

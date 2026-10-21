// Lógica pura del CRM de oportunidades (módulo Leads), sin dependencias de la base.
import { type OpportunityStage, OPPORTUNITY_STAGE_LABELS, OPPORTUNITY_STAGES } from "./constants";

export const OPEN_STAGES: readonly OpportunityStage[] = ["nuevo", "contacto", "propuesta"];
export const isClosed = (s: OpportunityStage) => s === "ganado" || s === "perdido";

type ClientType = "recurrente" | "especial";

/** Cliente vinculado al lead: decide si ganar lo crea, lo convierte o solo lo deja como está. */
type LinkedClient = { type: "recurrente" | "especial" | "potencial" } | null;

export type LeadMove =
  | {
      ok: true;
      stage: OpportunityStage;
      closedAt: string | null;
      lostReason: string | null;
      noteText: string;
      /** Qué hacer con el cliente: crear uno nuevo, convertir el potencial vinculado, inactivarlo o nada. */
      client:
        | { action: "create"; type: ClientType }
        | { action: "convert"; type: ClientType }
        | { action: "lose" }
        | { action: "none" };
    }
  | { ok: false; error: string };

/**
 * Cambio de etapa de una oportunidad.
 * - Ganado: si no hay cliente (o es potencial) exige elegir recurrente/especial; crea o activa el cliente.
 * - Perdido: exige motivo; un cliente potencial vinculado queda inactivo.
 * - Desde un cierre solo se reabre a Contacto o Propuesta.
 */
export function moveLead(
  from: OpportunityStage,
  to: OpportunityStage,
  opts: { date: string; client: LinkedClient; type?: string | null; lostReason?: string | null },
): LeadMove {
  if (!OPPORTUNITY_STAGES.includes(to)) return { ok: false, error: "Etapa inválida." };
  if (from === to) return { ok: false, error: "La oportunidad ya está en esa etapa." };
  if (isClosed(from) && isClosed(to)) return { ok: false, error: "Primero reabrí la oportunidad." };
  if (isClosed(from) && to === "nuevo") return { ok: false, error: "Una oportunidad cerrada se reabre en Contacto o Propuesta." };

  const noteText = `Etapa: ${OPPORTUNITY_STAGE_LABELS[from]} → ${OPPORTUNITY_STAGE_LABELS[to]}`;
  const base = { ok: true as const, stage: to, closedAt: null, lostReason: null, noteText };

  if (to === "ganado") {
    const needsType = !opts.client || opts.client.type === "potencial";
    if (!needsType) return { ...base, closedAt: opts.date, client: { action: "none" } };
    if (opts.type !== "recurrente" && opts.type !== "especial") {
      return { ok: false, error: "Elegí si el cliente es recurrente o especial." };
    }
    const label = opts.type === "recurrente" ? "Recurrente" : "Especial";
    return {
      ...base,
      closedAt: opts.date,
      noteText: `${noteText} (${label})`,
      client: { action: opts.client ? "convert" : "create", type: opts.type },
    };
  }
  if (to === "perdido") {
    const reason = opts.lostReason?.trim();
    if (!reason) return { ok: false, error: "Indicá el motivo por el que se perdió." };
    return {
      ...base,
      closedAt: opts.date,
      lostReason: reason,
      noteText: `${noteText}: ${reason}`,
      client: { action: opts.client?.type === "potencial" ? "lose" : "none" },
    };
  }
  return { ...base, client: { action: "none" } };
}

/** Próxima acción vencida: tiene fecha anterior a hoy y la oportunidad sigue abierta. */
export function isOverdue(lead: { stage: OpportunityStage; nextActionDate: string | null }, date: string) {
  return !isClosed(lead.stage) && !!lead.nextActionDate && lead.nextActionDate < date;
}

/** Resumen por columna del Kanban: cantidad y suma de montos estimados. */
export function stageTotals<T extends { stage: OpportunityStage; expectedAmount: number | null }>(rows: T[]) {
  const totals = Object.fromEntries(OPPORTUNITY_STAGES.map((s) => [s, { count: 0, amount: 0 }])) as Record<
    OpportunityStage,
    { count: number; amount: number }
  >;
  for (const r of rows) {
    totals[r.stage].count++;
    totals[r.stage].amount += r.expectedAmount ?? 0;
  }
  return totals;
}

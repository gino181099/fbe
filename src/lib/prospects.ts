// Lógica pura del embudo de clientes potenciales (sin dependencias de la base).
import { type ClientType, type LeadPriority, type LeadStage, LEAD_PRIORITIES, LEAD_STAGE_LABELS } from "./constants";

type ClientStatus = "activo" | "potencial" | "inactivo";

/** Etapas en las que el contacto sigue siendo un prospecto (tipo "potencial"). */
export const FUNNEL_STAGES: readonly LeadStage[] = ["sin_contactar", "contactado", "perdido"];

export const normalizeName = (s: string) => s.trim().toLowerCase();

/* ───────────────────────────── Transiciones ───────────────────────────── */

export type StageTransition =
  | { ok: true; status: ClientStatus; leadStage: LeadStage; type: ClientType; noteText: string }
  | { ok: false; error: string };

/**
 * Cambio de etapa del embudo. "ganado" exige elegir recurrente o especial y activa al cliente;
 * "perdido" lo inactiva; "sin_contactar"/"contactado" lo dejan (o lo reabren) como potencial.
 */
export function stageTransition(from: LeadStage | null, to: LeadStage, type?: string | null): StageTransition {
  if (from === to) return { ok: false, error: "El contacto ya está en esa etapa." };
  if (from === "ganado") return { ok: false, error: "Es un cliente ganado: ya no está en el embudo." };
  const note = `Etapa: ${from ? LEAD_STAGE_LABELS[from] : "—"} → ${LEAD_STAGE_LABELS[to]}`;
  if (to === "ganado") {
    if (type !== "recurrente" && type !== "especial") {
      return { ok: false, error: "Elegí si es recurrente o especial." };
    }
    const label = type === "recurrente" ? "Recurrente" : "Especial";
    return { ok: true, status: "activo", leadStage: "ganado", type, noteText: `${note} (${label})` };
  }
  if (to === "perdido") return { ok: true, status: "inactivo", leadStage: "perdido", type: "potencial", noteText: note };
  return { ok: true, status: "potencial", leadStage: to, type: "potencial", noteText: note };
}

/**
 * Coherencia tipo/estado del formulario de contacto y la etapa resultante.
 * Tipo "potencial" ⇔ está en el embudo (sin contactar, contactado o perdido).
 * `hasTrips`: el contacto ya tiene recorridos → no puede ser potencial (le bloquearía editarlos).
 */
export function formLeadStage(
  type: ClientType,
  status: ClientStatus,
  current: LeadStage | null,
  hasTrips = false,
): { ok: true; leadStage: LeadStage | null } | { ok: false; error: string } {
  if (type === "potencial") {
    if (hasTrips) return { ok: false, error: "No se puede pasar a Potencial un cliente que ya tiene recorridos." };
    if (status === "activo") return { ok: false, error: "Un cliente activo no puede ser potencial: elegí si es recurrente o especial." };
    if (status === "inactivo") return { ok: true, leadStage: "perdido" };
    return { ok: true, leadStage: current === "contactado" ? "contactado" : "sin_contactar" };
  }
  if (status === "potencial") return { ok: false, error: "Un contacto con estado Potencial tiene que tener tipo Potencial." };
  // Salió del embudo desde el formulario: queda como ganado (dato de origen).
  return { ok: true, leadStage: current && FUNNEL_STAGES.includes(current) ? "ganado" : current };
}

/** Solo el autor borra sus notas; las automáticas no se borran nunca (ni el admin). */
export function canDeleteNote(note: { auto: boolean; userId: string | null }, userId: string | null | undefined) {
  return !note.auto && !!note.userId && note.userId === userId;
}

/* ─────────────────────────────── Importación ────────────────────────────── */

export type ProspectJson = {
  nombre: string;
  segmento?: string | null;
  rubro?: string | null;
  sitio_web?: string | null;
  ubicacion?: string | null;
  direccion?: string | null;
  descripcion?: string | null;
  motivo_encaje?: string | null;
  angulo_venta?: string | null;
  encaje?: number | null;
  puntaje?: number | null;
  prioridad?: string | null;
  notas?: string | null;
  contacto?: {
    emails?: string[];
    telefonos?: string[];
    whatsapp?: string[];
    redes?: Record<string, string | null | undefined>;
  };
};

export type ProspectRow = {
  name: string;
  type: "potencial";
  status: "potencial";
  leadStage: "sin_contactar";
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  segment: string | null;
  leadPriority: LeadPriority | null;
  notes: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

/** JSON de la lista de prospectos → fila de `client`. */
export function mapProspect(p: ProspectJson): ProspectRow {
  const c = p.contacto ?? {};
  const emails = (c.emails ?? []).map((e) => e.trim()).filter(Boolean);
  const phones = (c.telefonos ?? []).map((t) => t.trim()).filter(Boolean);
  const whatsapp = (c.whatsapp ?? []).map((t) => t.trim()).filter(Boolean);
  const email = emails[0] && EMAIL_RE.test(emails[0]) ? emails[0] : null;
  const phone = whatsapp[0] ?? phones[0] ?? null;
  const priority = LEAD_PRIORITIES.find((x) => x === p.prioridad?.trim().toLowerCase()) ?? null;

  const redes = Object.entries(c.redes ?? {})
    .filter(([, v]) => clean(v))
    .map(([k, v]) => `${k}: ${v!.trim()}`);
  const otherEmails = email ? emails.slice(1) : emails;
  const otherPhones = phones.filter((t) => t !== phone);
  const score = [p.puntaje != null && `puntaje ${p.puntaje}`, p.encaje != null && `encaje ${p.encaje}/5`].filter(Boolean);

  const lines: [string, string | null][] = [
    ["Rubro", clean(p.rubro)],
    ["Descripción", clean(p.descripcion)],
    ["Motivo de encaje", clean(p.motivo_encaje)],
    ["Ángulo de venta", clean(p.angulo_venta)],
    ["Otros emails", otherEmails.length ? otherEmails.join(", ") : null],
    ["Otros teléfonos", otherPhones.length ? otherPhones.join(", ") : null],
    ["WhatsApp", whatsapp.length ? whatsapp.join(", ") : null],
    ["Redes", redes.length ? redes.join(" · ") : null],
    ["Notas del relevamiento", clean(p.notas)],
    ["Puntaje/Encaje", score.length ? score.join(", ") : null],
  ];
  const notes = lines.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");

  return {
    name: p.nombre.trim(),
    type: "potencial",
    status: "potencial",
    leadStage: "sin_contactar",
    email,
    phone,
    address: clean(p.direccion) ?? clean(p.ubicacion),
    website: clean(p.sitio_web),
    segment: clean(p.segmento),
    leadPriority: priority,
    notes: notes || null,
  };
}

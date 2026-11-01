// Texto del resumen diario de la agenda (notificación de las 8:00). Lógica pura, sin base.

export type DigestItem = { title: string; dueDate: string };
export type Digest = { title: string; body: string };

const MAX_TITLES = 3;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Resumen de las pendientes de un usuario (vencidas y de hoy). null si no tiene ninguna: no se manda nada. */
export function agendaDigest(items: DigestItem[], today: string): Digest | null {
  const overdue = items.filter((i) => i.dueDate < today);
  const dueToday = items.filter((i) => i.dueDate === today);
  if (!overdue.length && !dueToday.length) return null;
  const parts = [
    overdue.length ? plural(overdue.length, "vencida", "vencidas") : null,
    dueToday.length ? plural(dueToday.length, "para hoy", "para hoy") : null,
  ].filter(Boolean);
  // Primero las vencidas (más viejas primero), después las de hoy.
  const titles = [...overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate)), ...dueToday].map((i) => i.title);
  const rest = titles.length - MAX_TITLES;
  const body = titles.slice(0, MAX_TITLES).join(" · ") + (rest > 0 ? ` y ${rest} más` : "");
  return { title: `Agenda: ${parts.join(" y ")}`, body };
}

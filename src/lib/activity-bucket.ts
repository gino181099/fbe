import { addDays } from "./format";

export type ActivityBucket = "vencida" | "hoy" | "semana" | "despues";

export const ACTIVITY_BUCKET_LABELS: Record<ActivityBucket, string> = {
  vencida: "Vencidas",
  hoy: "Hoy",
  semana: "Próximos 7 días",
  despues: "Más adelante",
};

/** En qué grupo de la agenda cae una actividad pendiente (fechas "YYYY-MM-DD"). */
export function activityBucket(dueDate: string, today: string): ActivityBucket {
  if (dueDate < today) return "vencida";
  if (dueDate === today) return "hoy";
  if (dueDate <= addDays(today, 7)) return "semana";
  return "despues";
}

/** Colores de Odoo: rojo vencida, amarillo hoy, verde planificada (mañana o después). */
export type ActivityColor = "red" | "yellow" | "green" | "done";

export function activityColor(dueDate: string, today: string, done = false): ActivityColor {
  if (done) return "done";
  const b = activityBucket(dueDate, today);
  return b === "vencida" ? "red" : b === "hoy" ? "yellow" : "green";
}

/** Clases por color: `chip` (fondo suave, calendario), `dot` (punto), `text` (fecha en listas). */
export const ACTIVITY_COLOR_CLASSES: Record<ActivityColor, { chip: string; dot: string; text: string }> = {
  red: {
    chip: "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400 font-medium",
  },
  yellow: {
    chip: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
    dot: "bg-amber-400",
    text: "text-amber-700 dark:text-amber-400 font-medium",
  },
  green: {
    chip: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  done: {
    chip: "border-border bg-muted text-muted-foreground line-through",
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
  },
};

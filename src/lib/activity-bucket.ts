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

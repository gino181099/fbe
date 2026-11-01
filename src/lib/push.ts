import "server-only";
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { activities, pushSubscriptions } from "@/db/schema";
import { agendaDigest } from "./agenda-digest";
import { today } from "./format";

export type PushPayload = { title: string; body: string; url?: string };

/** Claves VAPID (variables de entorno). Sin ellas las notificaciones quedan apagadas. */
function vapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.");
  // Contacto que piden los servicios de push (Apple exige una URL o mailto real): la URL del sitio en Vercel.
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "frabel-erp.vercel.app";
  return { subject: `https://${host}`, publicKey, privateKey };
}

type Subscription = typeof pushSubscriptions.$inferSelect;

/** Manda a cada dispositivo; borra los que ya no existen (el navegador los dio de baja). Devuelve cuántos llegaron. */
async function sendTo(subs: Subscription[], payload: PushPayload) {
  const v = vapid();
  const gone: number[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          vapidDetails: v,
          TTL: 12 * 60 * 60,
        });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.id);
        else console.error("Push fallido", status, e);
      }
    }),
  );
  if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
  return sent;
}

export async function sendToUser(userId: string, payload: PushPayload) {
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  return sendTo(subs, payload);
}

/** Resumen diario: a cada usuario con notificaciones activadas, sus pendientes vencidas y de hoy. */
export async function sendAgendaDigests() {
  const subs = await db.select().from(pushSubscriptions);
  const userIds = [...new Set(subs.map((s) => s.userId))];
  if (!userIds.length) return { users: 0, sent: 0 };
  const day = today();
  const pending = await db
    .select({ assignedTo: activities.assignedTo, title: activities.title, dueDate: activities.dueDate })
    .from(activities)
    .where(and(inArray(activities.assignedTo, userIds), isNull(activities.doneAt), lte(activities.dueDate, day)));
  let users = 0;
  let sent = 0;
  for (const userId of userIds) {
    const digest = agendaDigest(
      pending.filter((p) => p.assignedTo === userId),
      day,
    );
    if (!digest) continue;
    users++;
    sent += await sendTo(
      subs.filter((s) => s.userId === userId),
      { ...digest, url: "/agenda?vista=lista" },
    );
  }
  return { users, sent };
}

"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { type ActionResult, checkUser } from "@/lib/permissions";
import { sendToUser } from "@/lib/push";

const subscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

/** Activa las notificaciones en este dispositivo y manda una de prueba. */
export async function subscribePush(raw: unknown): Promise<ActionResult> {
  const { user, error } = await checkUser();
  if (error) return error;
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "El navegador no devolvió una suscripción válida." };
  const { endpoint, keys } = parsed.data;
  // El mismo dispositivo puede pasar a otro usuario (otra sesión): el endpoint es único.
  await db
    .insert(pushSubscriptions)
    .values({ userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth } });
  try {
    await sendToUser(user.id, {
      title: "Notificaciones activadas",
      body: "Todos los días a las 8:00 te llega el resumen de tus actividades vencidas y de hoy.",
      url: "/agenda",
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Se guardó, pero no se pudo mandar la notificación de prueba." };
  }
  return { ok: true, message: "Notificaciones activadas en este dispositivo" };
}

export async function unsubscribePush(endpoint: string): Promise<ActionResult> {
  const { error } = await checkUser();
  if (error) return error;
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  return { ok: true, message: "Notificaciones desactivadas en este dispositivo" };
}

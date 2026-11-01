import { sendAgendaDigests } from "@/lib/push";

/**
 * Resumen diario de la agenda por notificación. Lo llama el cron de Vercel (`vercel.json`, 11:00 UTC = 8:00 en AR)
 * con `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("No autorizado", { status: 401 });
  }
  return Response.json(await sendAgendaDigests());
}

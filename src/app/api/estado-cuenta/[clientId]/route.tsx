import { renderToBuffer } from "@react-pdf/renderer";
import { getStatement } from "@/lib/balances";
import { today } from "@/lib/format";
import { can, getCurrentUser } from "@/lib/permissions";
import { StatementPdf } from "@/lib/statement-pdf";

const isDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function GET(request: Request, { params }: RouteContext<"/api/estado-cuenta/[clientId]">) {
  const user = await getCurrentUser();
  if (!user || !can(user, "finanzas", "view")) {
    return new Response("No autorizado", { status: 403 });
  }
  const clientId = Number((await params).clientId);
  const url = new URL(request.url);
  const to = isDate(url.searchParams.get("hasta")) ?? today();
  const from = isDate(url.searchParams.get("desde")) ?? `${to.slice(0, 4)}-01-01`;
  const data = Number.isInteger(clientId) ? await getStatement(clientId, from, to) : null;
  if (!data) return new Response("Cliente no encontrado", { status: 404 });

  const pdf = await renderToBuffer(<StatementPdf data={data} issuedAt={today()} />);
  const filename = `estado-de-cuenta-${data.client.name.replace(/[^\w-]+/g, "-")}-${to}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

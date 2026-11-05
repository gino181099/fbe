import { renderToBuffer } from "@react-pdf/renderer";
import { formatReceiptNumber } from "@/lib/doc-number";
import { can, getCurrentUser } from "@/lib/permissions";
import { ReceiptPdf } from "@/lib/receipt-pdf";
import { getReceipt } from "@/lib/receipts";
import { parseId } from "@/lib/ids";

/** PDF del recibo numerado (también de los anulados, con la marca "ANULADO"). */
export async function GET(_request: Request, { params }: RouteContext<"/api/recibo/[id]">) {
  const user = await getCurrentUser();
  if (!user || !can(user, "finanzas", "view")) {
    return new Response("No autorizado", { status: 403 });
  }
  const id = parseId((await params).id);
  const receipt = id !== null ? await getReceipt(id) : null;
  if (!receipt) return new Response("Recibo no encontrado", { status: 404 });

  const pdf = await renderToBuffer(<ReceiptPdf receipt={receipt} />);
  const filename = `recibo-${formatReceiptNumber(receipt.number).replace(/\s+/g, "-")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

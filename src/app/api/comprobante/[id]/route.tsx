import { renderToBuffer } from "@react-pdf/renderer";
import { formatDocNumber } from "@/lib/doc-number";
import { DocumentPdf } from "@/lib/document-pdf";
import { getDocument } from "@/lib/documents";
import { can, getCurrentUser } from "@/lib/permissions";

/** PDF del comprobante interno (solo tipo `interno`). */
export async function GET(_request: Request, { params }: RouteContext<"/api/comprobante/[id]">) {
  const user = await getCurrentUser();
  if (!user || !can(user, "finanzas", "view")) {
    return new Response("No autorizado", { status: 403 });
  }
  const id = Number((await params).id);
  const doc = Number.isInteger(id) ? await getDocument(id) : null;
  if (!doc || doc.type !== "interno") return new Response("Comprobante no encontrado", { status: 404 });

  const pdf = await renderToBuffer(<DocumentPdf doc={doc} />);
  const filename = `comprobante-${formatDocNumber(doc.letter, doc.pos, doc.number).replace(/\s+/g, "-")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

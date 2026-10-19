import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatDocNumber } from "./doc-number";
import type { getDocument } from "./documents";
import { formatDate, formatMoney } from "./format";
import { PdfBrandHeader } from "./pdf-brand";

type Doc = NonNullable<Awaited<ReturnType<typeof getDocument>>>;

const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 48, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  muted: { color: "#666" },
  title: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 2, textAlign: "right" },
  number: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 4, textAlign: "right" },
  notFiscal: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#b91c1c", marginBottom: 4, textAlign: "right" },
  box: { borderWidth: 1, borderColor: "#ddd", borderRadius: 4, padding: 10, marginBottom: 14 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e5e5", paddingVertical: 4 },
  head: { flexDirection: "row", backgroundColor: "#f4f4f5", paddingVertical: 5, fontFamily: "Helvetica-Bold" },
  cDate: { width: "15%", paddingHorizontal: 4 },
  cDesc: { width: "63%", paddingHorizontal: 4 },
  cNum: { width: "22%", paddingHorizontal: 4, textAlign: "right" },
  total: {
    marginTop: 12,
    alignSelf: "flex-end",
    width: "45%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#111",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  voided: {
    position: "absolute",
    top: 330,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 72,
    fontFamily: "Helvetica-Bold",
    color: "#dc2626",
    opacity: 0.25,
    transform: "rotate(-30deg)",
  },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#888", textAlign: "center" },
});

/** PDF del comprobante interno (no fiscal). */
export function DocumentPdf({ doc }: { doc: Doc }) {
  const { client } = doc;
  const number = `Comprobante interno ${formatDocNumber(doc.letter, doc.pos, doc.number)}`;
  return (
    <Document title={number} author="Frabel">
      <Page size="A4" style={s.page}>
        <PdfBrandHeader>
          <Text style={s.title}>Comprobante interno</Text>
          <Text style={s.number}>{formatDocNumber(doc.letter, doc.pos, doc.number)}</Text>
          <Text style={s.notFiscal}>Documento no válido como factura</Text>
          <Text style={s.muted}>Fecha {formatDate(doc.date)}</Text>
          {doc.dueDate && <Text style={s.muted}>Vencimiento {formatDate(doc.dueDate)}</Text>}
        </PdfBrandHeader>

        <View style={s.box}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>{client.name}</Text>
          {client.cuit && <Text style={s.muted}>CUIT {client.cuit}</Text>}
          {client.address && <Text style={s.muted}>{client.address}</Text>}
        </View>

        <View style={s.head} fixed>
          <Text style={s.cDate}>Fecha</Text>
          <Text style={s.cDesc}>Detalle</Text>
          <Text style={s.cNum}>Importe</Text>
        </View>
        {doc.items.map((it) => (
          <View style={s.row} key={it.id} wrap={false}>
            <Text style={s.cDate}>{formatDate(it.date)}</Text>
            <Text style={s.cDesc}>{it.description}</Text>
            <Text style={s.cNum}>{formatMoney(it.amount)}</Text>
          </View>
        ))}

        <View style={s.total} wrap={false}>
          <Text>Total</Text>
          <Text>{formatMoney(doc.amount)}</Text>
        </View>
        {doc.notes && <Text style={[s.muted, { marginTop: 12 }]}>Observaciones: {doc.notes}</Text>}

        {doc.voidedAt && (
          <Text style={s.voided} fixed>
            ANULADO
          </Text>
        )}
        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `${number} · Documento no válido como factura · Página ${pageNumber} de ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

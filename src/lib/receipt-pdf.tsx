import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { amountInWords } from "./amount-words";
import { formatReceiptNumber } from "./doc-number";
import { formatDate, formatMoney } from "./format";
import { PdfBrandHeader } from "./pdf-brand";
import type { getReceipt } from "./receipts";

type Receipt = NonNullable<Awaited<ReturnType<typeof getReceipt>>>;

const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 48, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  muted: { color: "#666" },
  bold: { fontFamily: "Helvetica-Bold" },
  title: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 2, textAlign: "right" },
  number: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 4, textAlign: "right" },
  notFiscal: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#b91c1c", marginBottom: 4, textAlign: "right" },
  box: { borderWidth: 1, borderColor: "#ddd", borderRadius: 4, padding: 12, marginBottom: 14, lineHeight: 1.5 },
  sectionTitle: { fontFamily: "Helvetica-Bold", marginBottom: 4 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e5e5", paddingVertical: 4, fontSize: 9 },
  head: { flexDirection: "row", backgroundColor: "#f4f4f5", paddingVertical: 5, fontFamily: "Helvetica-Bold", fontSize: 9 },
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
  signature: { marginTop: 60, alignSelf: "flex-end", width: "40%", borderTopWidth: 0.75, borderTopColor: "#111", paddingTop: 4, textAlign: "center", fontSize: 9 },
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

/** PDF del recibo numerado (no fiscal): monto en letras, viajes tildados y/o "a cuenta del saldo". */
export function ReceiptPdf({ receipt }: { receipt: Receipt }) {
  const { client } = receipt;
  const number = formatReceiptNumber(receipt.number);
  const assigned = receipt.trips.reduce((sum, t) => sum + t.amount, 0);
  const onAccount = Math.round((receipt.amount - assigned) * 100) / 100;
  const clientDetails = [client.cuit ? `CUIT ${client.cuit}` : null, client.address].filter(Boolean).join(", ");
  return (
    <Document title={`Recibo ${number}`} author="Frabel">
      <Page size="A4" style={s.page}>
        <PdfBrandHeader>
          <Text style={s.title}>Recibo X</Text>
          <Text style={s.number}>N° {number.replace(/^X\s*/, "")}</Text>
          <Text style={s.notFiscal}>Documento no válido como factura</Text>
          <Text style={s.muted}>Fecha {formatDate(receipt.date)}</Text>
        </PdfBrandHeader>

        <View style={s.box}>
          <Text>
            Recibimos de <Text style={s.bold}>{client.name}</Text>
            {clientDetails ? ` (${clientDetails})` : ""} la suma de{" "}
            <Text style={s.bold}>{amountInWords(receipt.amount).replace(/^Pesos/, "pesos")}</Text> (
            <Text style={s.bold}>{formatMoney(receipt.amount)}</Text>).
          </Text>
          {receipt.method && <Text style={{ marginTop: 6 }}>Medio de pago: {receipt.method}</Text>}
        </View>

        <Text style={s.sectionTitle}>Concepto</Text>
        {receipt.trips.length > 0 && (
          <>
            <View style={s.head} fixed>
              <Text style={s.cDate}>Fecha</Text>
              <Text style={s.cDesc}>Recorrido</Text>
              <Text style={s.cNum}>Importe</Text>
            </View>
            {receipt.trips.map((t) => (
              <View style={s.row} key={t.id} wrap={false}>
                <Text style={s.cDate}>{formatDate(t.date)}</Text>
                <Text style={s.cDesc}>
                  {t.description}
                  {Math.abs(t.amount - t.price) >= 0.01 ? ` (precio ${formatMoney(t.price)})` : ""}
                </Text>
                <Text style={s.cNum}>{formatMoney(t.amount)}</Text>
              </View>
            ))}
          </>
        )}
        {onAccount >= 0.01 && (
          <View style={s.row} wrap={false}>
            <Text style={s.cDate} />
            <Text style={s.cDesc}>A cuenta del saldo</Text>
            <Text style={s.cNum}>{formatMoney(onAccount)}</Text>
          </View>
        )}

        <View style={s.total} wrap={false}>
          <Text>Total recibido</Text>
          <Text>{formatMoney(receipt.amount)}</Text>
        </View>
        {receipt.notes && <Text style={[s.muted, { marginTop: 12 }]}>Observaciones: {receipt.notes}</Text>}

        <Text style={s.signature}>Firma y aclaración</Text>

        {receipt.voidedAt && (
          <Text style={s.voided} fixed>
            ANULADO
          </Text>
        )}
        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `Recibo ${number} · Documento no válido como factura · Página ${pageNumber} de ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

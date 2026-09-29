import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { getStatement } from "./balances";
import { formatDate, formatMoney } from "./format";

type Statement = NonNullable<Awaited<ReturnType<typeof getStatement>>>;

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  muted: { color: "#666" },
  title: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  box: { borderWidth: 1, borderColor: "#ddd", borderRadius: 4, padding: 10, marginBottom: 14 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e5e5", paddingVertical: 4 },
  head: { flexDirection: "row", backgroundColor: "#f4f4f5", paddingVertical: 5, fontFamily: "Helvetica-Bold" },
  cDate: { width: "13%", paddingHorizontal: 4 },
  cDesc: { width: "39%", paddingHorizontal: 4 },
  cNum: { width: "16%", paddingHorizontal: 4, textAlign: "right" },
  summary: { marginTop: 14, alignSelf: "flex-end", width: "45%" },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#111",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#888", textAlign: "center" },
});

export function StatementPdf({ data, issuedAt }: { data: Statement; issuedAt: string }) {
  const { client } = data;
  return (
    <Document title={`Estado de cuenta ${client.name}`} author="Frabel">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>Frabel</Text>
            <Text style={s.muted}>Transporte de pasajeros</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.title}>Estado de cuenta</Text>
            <Text style={s.muted}>
              Período {formatDate(data.from)} al {formatDate(data.to)}
            </Text>
            <Text style={s.muted}>Emitido el {formatDate(issuedAt)}</Text>
          </View>
        </View>

        <View style={s.box}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>{client.name}</Text>
          {client.cuit && <Text style={s.muted}>CUIT {client.cuit}</Text>}
          {client.address && <Text style={s.muted}>{client.address}</Text>}
          {client.email && <Text style={s.muted}>{client.email}</Text>}
        </View>

        <View style={s.head} fixed>
          <Text style={s.cDate}>Fecha</Text>
          <Text style={s.cDesc}>Detalle</Text>
          <Text style={s.cNum}>Debe</Text>
          <Text style={s.cNum}>Haber</Text>
          <Text style={s.cNum}>Saldo</Text>
        </View>
        <View style={s.row}>
          <Text style={s.cDate}>{formatDate(data.from)}</Text>
          <Text style={[s.cDesc, { fontFamily: "Helvetica-Oblique" }]}>Saldo anterior</Text>
          <Text style={s.cNum} />
          <Text style={s.cNum} />
          <Text style={s.cNum}>{formatMoney(data.opening)}</Text>
        </View>
        {data.lines.map((l, i) => (
          <View style={s.row} key={i} wrap={false}>
            <Text style={s.cDate}>{formatDate(l.date)}</Text>
            <Text style={s.cDesc}>{l.description}</Text>
            <Text style={s.cNum}>{l.debit ? formatMoney(l.debit) : ""}</Text>
            <Text style={s.cNum}>{l.credit ? formatMoney(l.credit) : ""}</Text>
            <Text style={s.cNum}>{formatMoney(l.balance)}</Text>
          </View>
        ))}

        <View style={s.summary} wrap={false}>
          <View style={s.sumRow}>
            <Text>Saldo anterior</Text>
            <Text>{formatMoney(data.opening)}</Text>
          </View>
          <View style={s.sumRow}>
            <Text>Recorridos del período ({data.lines.filter((l) => l.kind === "recorrido").length})</Text>
            <Text>{formatMoney(data.totalDebit)}</Text>
          </View>
          <View style={s.sumRow}>
            <Text>Pagos recibidos</Text>
            <Text>- {formatMoney(data.totalCollected)}</Text>
          </View>
          {Math.abs(data.totalCredit - data.totalCollected) >= 0.01 && (
            <View style={s.sumRow}>
              <Text>Ajustes</Text>
              <Text>- {formatMoney(data.totalCredit - data.totalCollected)}</Text>
            </View>
          )}
          <View style={s.total}>
            <Text>{data.closing >= 0 ? "Saldo a pagar" : "Saldo a favor"}</Text>
            <Text>{formatMoney(Math.abs(data.closing))}</Text>
          </View>
        </View>

        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) => `Frabel · Estado de cuenta ${client.name} · Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

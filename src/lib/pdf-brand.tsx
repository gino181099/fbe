// Encabezado común de los PDFs (react-pdf): logo + datos de la empresa + bloque derecho a elección.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { COMPANY } from "./company";

let logo: Buffer | null | undefined;

/**
 * Logo color achicado a 256 px (`frabel-logo-pdf.png`, ~40 KB; el original pesa 750 KB y se incrustaba entero
 * en cada PDF), leído una vez; null si no está en el deploy.
 */
function getLogo() {
  if (logo === undefined) {
    try {
      logo = readFileSync(path.join(process.cwd(), "public", "brand", "frabel-logo-pdf.png"));
    } catch {
      logo = null;
    }
  }
  return logo;
}

const s = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  left: { flexDirection: "row", alignItems: "center", gap: 10, maxWidth: "60%" },
  logo: { width: 64, height: 64, objectFit: "contain" },
  name: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  muted: { color: "#555", fontSize: 8 },
  right: { alignItems: "flex-end", maxWidth: "40%" },
});

export function PdfBrandHeader({ children }: { children?: ReactNode }) {
  const img = getLogo();
  return (
    <View style={s.header} fixed>
      <View style={s.left}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no tiene alt */}
        {img && <Image style={s.logo} src={{ data: img, format: "png" }} />}
        <View>
          <Text style={s.name}>{COMPANY.name}</Text>
          <Text style={s.muted}>
            {COMPANY.taxCondition} · CUIT {COMPANY.cuit}
          </Text>
          <Text style={s.muted}>{COMPANY.address}</Text>
          <Text style={s.muted}>Tel./WhatsApp {COMPANY.phones}</Text>
          <Text style={s.muted}>{COMPANY.email}</Text>
        </View>
      </View>
      <View style={s.right}>{children}</View>
    </View>
  );
}

import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Frabel ERP", template: "%s · Frabel ERP" },
  description: "Gestión de clientes, recorridos y finanzas de Frabel",
  // Instalable en iPhone ("Agregar a pantalla de inicio"): lo necesita para recibir notificaciones.
  appleWebApp: { capable: true, title: "Frabel" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes agrega la clase `dark` antes de hidratar.
    <html lang="es" className={`${instrumentSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Caveat, Fraunces, Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
// Letra manuscrita para las cartas del diario.
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });

export const metadata: Metadata = {
  title: "Crecer — acompañamiento del desarrollo infantil",
  description:
    "Ficha de crecimiento, cartilla de vacunación, hitos del desarrollo y diario de recuerdos, desde el nacimiento hasta la adolescencia.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FDFBF7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${nunito.variable} ${fraunces.variable} ${caveat.variable}`}>
      <body>{children}</body>
    </html>
  );
}

/**
 * ROOT_LAYOUT
 *
 * Purpose: Defines global metadata, typography, language, and document structure for the app.
 * Connections: Next.js App Router, global styles, and Google-hosted application fonts.
 * Risk: Medium because layout behavior affects every route and rendered document.
 */
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";

import "./globals.css";

const bodyFont = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const displayFont = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Gia phả họ Nguyễn Làng Khô",
    template: "%s | Gia phả họ Nguyễn Làng Khô",
  },
  description:
    "Nền tảng số để lưu giữ, kiểm chứng và khám phá gia phả họ Nguyễn Làng Khô.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        {children}
      </body>
    </html>
  );
}

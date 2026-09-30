import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Jost } from "next/font/google";

import { site } from "@/lib/site";

import "./globals.css";

// Bodoni for the private-client voice (headings, prices); Jost (Futura-like) for everything else.
const display = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

const body = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.siteUrl),
  alternates: { canonical: "/" },
  title: `LeaseLine: talk to ${site.persona.name} about homes for rent in ${site.team.city}`,
  description: `${site.persona.name} is an AI leasing assistant who matches you with a rental home and books a showing.`,
};

export const viewport: Viewport = { themeColor: site.brand.accent };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable}`}
      style={{ "--brand": site.brand.accent } as React.CSSProperties}
    >
      <body>{children}</body>
    </html>
  );
}

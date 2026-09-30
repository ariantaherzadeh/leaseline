import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from "next/font/google";

import { site } from "@/lib/site";

import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-display",
});

const body = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
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

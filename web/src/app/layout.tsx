import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { site } from "@/lib/site";

import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
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
      className={sans.variable}
      style={{ "--brand": site.brand.accent } as React.CSSProperties}
    >
      <body>{children}</body>
    </html>
  );
}

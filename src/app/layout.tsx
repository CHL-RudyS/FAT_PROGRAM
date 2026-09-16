import type { Metadata } from "next";
import { Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { LocaleProvider, type Locale } from "@/i18n/LocaleProvider";
import "./globals.css";

// Loaded without a `weight` list so next/font serves the variable font the
// prototype links from Google Fonts, optical-size axis included. Pinning
// weights ships static cuts instead, which drops `opsz` and renders the
// display design at 10-13px, where the small-size cut belongs.
const serif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FAT Program · Modul Akuntansi",
  description: "Sistem internal akuntansi PT. Cipta Harmoni Lestari",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const locale = (store.get("chl_locale")?.value === "EN" ? "EN" : "ID") as Locale;

  return (
    /* The font variables belong on <html>: globals.css builds --sans and --mono
       out of them on :root, and a custom property that references an undefined
       one is invalid at computed-value time — it resolves to nothing, and every
       screen silently falls back to Times New Roman. */
    <html lang={locale === "EN" ? "en" : "id"} className={`${serif.variable} ${mono.variable}`}>
      <body>
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}

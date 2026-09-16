import type { Metadata } from "next";
import { Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { LocaleProvider, type Locale } from "@/i18n/LocaleProvider";
import "./globals.css";

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
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
    <html lang={locale === "EN" ? "en" : "id"}>
      <body className={`${serif.variable} ${mono.variable}`}>
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}


import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import "./globals.css";
import GlobalStats from "@/components/coin/GlobalStats";
import NavBar from "@/components/coin/NavBar";
import PageContent from "@/app/@header/coin/PageContent"
import Providers from "@/app/providers";
import SiteFooter from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/site";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  // Lets pages give canonical and share-image URLs as plain paths.
  metadataBase: new URL(SITE_URL),
  title: "Crypto Tracker",
  description: "Cryptocurrency market tracker",
};

export default function RootLayout({
  children,
  profile,
}: Readonly<{
  children: React.ReactNode;
  profile: React.ReactNode;
}>) {
  return (
    // The head script sets the theme class before React hydrates.
    <html lang="en" className={fontSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh w-full flex flex-col bg-gray-50">
        <Providers>
          {/* Header bars span the full viewport; their contents and the
              page share one centered column with the same side gutter. */}
          <GlobalStats />
          <NavBar />

          <main className="mx-auto w-full max-w-5xl px-3 sm:px-4">
            <PageContent profile={profile}>
              {children}
            </PageContent>
          </main>

          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}

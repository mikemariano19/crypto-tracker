
import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import "./globals.css";
import GlobalStats from "@/components/coin/GlobalStats";
import NavBar from "@/components/coin/NavBar";
import PageContent from "@/app/@header/coin/PageContent"

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
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
    <html lang="en" className={fontSans.variable}>
      <body className="min-h-full w-full flex flex-col bg-gray-50">
        <div className="container mx-auto md:max-w-5xl">
          <GlobalStats />
          <NavBar />

          <PageContent profile={profile}>
            {children}
          </PageContent>
        </div>
      </body>
    </html>
  );
}

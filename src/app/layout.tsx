import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "@/components/providers";

// Bricolage Grotesque gives headings a warm, hand-set character.
// Atkinson Hyperlegible was designed for readability, which suits sellers who aren't finance people.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700", "800"] });
const body = Atkinson_Hyperlegible({ subsets: ["latin"], variable: "--font-body", weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "SellerShield",
  description: "AI that keeps small sellers' PayPal money safe and flowing",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("font-sans", display.variable, body.variable)}>
      <body className="antialiased min-h-screen">
        <Providers>
          <SiteHeader />
          <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-28">{children}</main>
        </Providers>
      </body>
    </html>
  );
}

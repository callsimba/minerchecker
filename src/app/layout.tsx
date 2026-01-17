import "./globals.css";
import { ThemeInitScript } from "@/components/theme-init";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "MinerChecker",
  description: "Enterprise-grade ASIC profitability analytics and marketplace intelligence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-bg text-fg" suppressHydrationWarning>
      <head>
        {/* Important: ThemeInitScript must live in the root <head> */}
        <ThemeInitScript />
      </head>
      <body className="min-h-dvh">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

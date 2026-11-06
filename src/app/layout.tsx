import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paper Copy — simulated Solana paper trading",
  description:
    "Paper Copy is an independent simulated paper-trading app for Solana memes and copy-watch. Not affiliated with Pump.fun. No wallet, no real money. Market data from DexScreener and public RPC (estimates only).",
  applicationName: "Paper Copy",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f4f7fb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

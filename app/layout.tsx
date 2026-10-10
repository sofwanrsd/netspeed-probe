import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NetSpeed Probe — High-Precision Domain & Network Diagnostic",
  description: "Diagnosa latensi DNS, TCP handshake, TLS negotiation, TTFB, dan kecepatan download server untuk domain apa pun.",
  authors: [{ name: "Sofwan Rosidi", url: "https://github.com/sofwanrsd" }],
  icons: { icon: "/favicon.ico" }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#09090b] text-[#f4f4f5] selection:bg-emerald-500/30 selection:text-emerald-300">
        {children}
      </body>
    </html>
  );
}

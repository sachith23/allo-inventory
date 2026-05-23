// src/app/layout.tsx
import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Allo Inventory",
  description: "Real-time inventory reservation platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body className="bg-[#0a0a0a] text-[#e8e8e8] font-sans antialiased min-h-screen">
        <nav className="border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5">
              <div className="w-6 h-6 bg-[#4ade80] rounded-sm flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="5" height="5" fill="#0a0a0a" />
                  <rect x="8" y="1" width="5" height="5" fill="#0a0a0a" />
                  <rect x="1" y="8" width="5" height="5" fill="#0a0a0a" />
                  <rect x="8" y="8" width="5" height="5" fill="#0a0a0a" opacity="0.4" />
                </svg>
              </div>
              <span className="font-semibold tracking-tight text-white text-sm">
                allo <span className="text-[#4ade80]">inventory</span>
              </span>
            </a>
            <span className="text-xs text-white/30 font-mono">v1.0.0</span>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}

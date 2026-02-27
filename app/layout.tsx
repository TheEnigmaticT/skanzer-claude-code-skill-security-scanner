import type { Metadata, Viewport } from "next";
import { Space_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Skanzer - Claude Code Skill Security Scanner",
  description: "Upload and scan Claude Code skills for security vulnerabilities. Detect data exfiltration, behavior mismatches, and privilege escalation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script defer src="https://umami-analytics-sigma-pink.vercel.app/script.js" data-website-id="98ef0087-9dae-4381-ab6b-372c8f84f2b2"></script>
      </head>
      <body className={`${spaceMono.variable} ${dmSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

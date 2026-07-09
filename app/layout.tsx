import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Mono, Inter } from "next/font/google";
import "./globals.css";

// Body / UI — highly legible modern grotesque.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Display — expressive contemporary grotesque for headlines.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Code / labels.
const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Soroban Studio — Visual development for Stellar & Soroban",
  description:
    "A visual development environment for building Stellar & Soroban apps with drag-and-drop workflows and AI-assisted generation. Export production-ready code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bricolage.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}

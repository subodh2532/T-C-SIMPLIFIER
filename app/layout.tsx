import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"]
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "T&C Simplifier",
  description: "Simplify dense Terms & Conditions with AI, OCR, voice, and multilingual support."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "T&C Simplifier",
  description:
    "Understand terms and conditions instantly with OCR, URL scanning, AI simplification, and voice playback."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "drawloom — form-first drawing overlays",
  description:
    "Upload a portrait and overlay Loomis construction, value reduction, anatomy, proportion checks, and shape-simplification exercises. Runs in your browser.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}

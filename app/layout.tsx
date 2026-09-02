import type { Metadata } from "next";
import { IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./providers";

// Substitutes for Parallel's proprietary gerstnerProgramm / ftSystemMono (DESIGN.md).
const serif = Source_Serif_4({
  variable: "--font-serif-var",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono-var",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Investment Copilot",
  description:
    "Turn an investment thesis into a researched shortlist of private companies worth a deeper look. Built on Parallel.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}

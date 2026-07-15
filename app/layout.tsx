import type { Metadata } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const serif = Newsreader({ variable: "--font-serif", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Window | AI governance readiness",
  description: "Explore where countries are ready to turn AI attention into meaningful policy.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Window | AI governance readiness",
    description: "Where is the next policy window opening?",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Window policy-window readiness explorer" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable}`}>{children}</body>
    </html>
  );
}

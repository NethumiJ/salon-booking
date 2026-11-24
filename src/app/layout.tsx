import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

export const dynamic = "force-dynamic"; // CSP nonces require per-request rendering

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Online Salon Booking in Sri Lanka | Book Haircuts & Beauty Appointments", template: "%s" },
  description:
    "Book salon appointments online in Sri Lanka. Find barbers and salons near you, choose your service, stylist and time, and confirm in seconds.",
  keywords: [
    "salon", "salon Sri Lanka", "salon booking", "online booking", "book salon online", "barber Sri Lanka",
    "haircut Colombo", "beauty salon Sri Lanka", "hair salon", "beard trim", "bridal salon", "salon appointment",
  ],
  applicationName: "Salon Booking Sri Lanka",
  robots: { index: true, follow: true },
  openGraph: { type: "website", locale: "en_LK", siteName: "Salon Booking Sri Lanka" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111827",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-LK" className={`${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

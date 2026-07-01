import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "InsiderClusters — Insider cluster-buy alerts";
const DESCRIPTION =
  "InsiderClusters watches every SEC Form 4 filing and alerts you when two or more insiders buy the same small-cap stock within days — the highest-signal pattern in insider trading.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | InsiderClusters",
  },
  description: DESCRIPTION,
  applicationName: "InsiderClusters",
  keywords: [
    "insider trading",
    "insider cluster buys",
    "SEC Form 4",
    "insider buying alerts",
    "small-cap stocks",
    "insider transactions",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "InsiderClusters",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // Set GOOGLE_SITE_VERIFICATION to the token from Search Console to verify via
  // meta tag (an alternative to the DNS TXT method).
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "InsiderClusters",
  url: SITE_URL,
  description: DESCRIPTION,
  parentOrganization: {
    "@type": "Organization",
    name: "Beelodev",
    url: "https://beelodev.com",
  },
  sameAs: ["https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </body>
    </html>
  );
}

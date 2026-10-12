import type { Metadata, Viewport } from "next";
import { DM_Sans, Newsreader, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const bodyFont = DM_Sans({
  variable: "--font-body",
  display: "swap",
  subsets: ["latin"],
});

const editorialFont = Newsreader({
  variable: "--font-editorial",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "Insider Buying & Cluster Alerts | InsiderClusters";
const DESCRIPTION =
  "Track insider buying and cluster purchases from SEC Form 4 filings. Explore stocks, insider histories, and sectors, with email and Telegram alerts.";

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
    "open-market purchases",
    "insider transactions",
  ],
  // NOTE: intentionally no `alternates.canonical` here. Metadata fields are
  // inherited by every route that doesn't override them, so a canonical set on
  // the root layout would make every page without its own canonical (e.g. a new
  // public page) claim to be a duplicate of "/". Each page declares its own.
  openGraph: {
    type: "website",
    siteName: "InsiderClusters",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
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

export const viewport: Viewport = {
  themeColor: "#234f3d",
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "InsiderClusters",
  url: SITE_URL,
  description: DESCRIPTION,
  parentOrganization: {
    "@type": "Organization",
    name: "Beelodev",
    url: "https://beelodev.com",
  },
  logo: `${SITE_URL}/icon.svg`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${editorialFont.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(orgJsonLd).replace(/</g, "\\u003c"),
          }}
        />
      </body>
    </html>
  );
}

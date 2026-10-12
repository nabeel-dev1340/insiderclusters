import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Gated app surface and machinery — no SEO value, keep it out of the index.
      disallow: ["/dashboard", "/api/", "/auth/", "/login"],
    },
    // Index plus the existing per-template sitemaps.
    sitemap: [
      `${SITE_URL}/sitemap-index.xml`,
      `${SITE_URL}/sitemap/core.xml`,
      `${SITE_URL}/sitemap/stocks.xml`,
      `${SITE_URL}/sitemap/insiders.xml`,
      `${SITE_URL}/sitemap/sectors.xml`,
      `${SITE_URL}/sitemap/learn.xml`,
      `${SITE_URL}/sitemap/months.xml`,
    ],
    host: SITE_URL,
  };
}

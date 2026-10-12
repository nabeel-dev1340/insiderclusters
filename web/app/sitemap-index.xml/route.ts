import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";
export function GET() {
  const sections = ["core", "stocks", "insiders", "sectors", "learn", "months"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sections.map((id) => `<sitemap><loc>${SITE_URL.replace(/&/g, "&amp;")}/sitemap/${id}.xml</loc></sitemap>`).join("")}</sitemapindex>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}

import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://hoosplanner.zrk.ventures";

// Plan pages are per-student (and noindex); only the public pages belong in search.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/schedule", "/cart", "/requirements", "/p/"] }, sitemap: `${SITE}/sitemap.xml` };
}

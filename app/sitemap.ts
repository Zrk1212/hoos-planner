import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://hoosplanner.zrk.ventures";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/about", "/privacy", "/terms", "/security"].map((p) => ({ url: `${SITE}${p}` }));
}

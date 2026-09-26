import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/account", "/status", "/legal"].map((p) => ({ url: `${APP_URL}${p}` }));
}

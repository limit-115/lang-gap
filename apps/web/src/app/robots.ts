import type { MetadataRoute } from "next";
import { isPreviewDeployment, siteUrl } from "@/shared/metadata";
export const dynamic = "force-static";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: isPreviewDeployment ? undefined : `${siteUrl}/sitemap.xml`,
  };
}

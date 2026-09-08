import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const config: NextConfig = {
  trailingSlash: true,
  poweredByHeader: false,
  // The root layout lives under [locale]; unmatched requests need their own document.
  experimental: { globalNotFound: true },
  transpilePackages: ["@llang-gap/contracts", "@llang-gap/evaluation"],
  outputFileTracingIncludes: { "/\\[locale\\]/run": ["../../datasets/*/manifest.json"] },
};
export default withNextIntl(config);

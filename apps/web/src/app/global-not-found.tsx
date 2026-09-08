import { getLocale } from "next-intl/server";
import { NotFoundContent } from "@/features/not-found/not-found-content";
import { SiteDocument } from "@/shared/site-document";

export default async function GlobalNotFound() {
  const locale = await getLocale();

  return (
    <SiteDocument locale={locale}>
      <NotFoundContent locale={locale} />
    </SiteDocument>
  );
}

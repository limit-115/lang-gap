import { NotFoundContent } from "@/features/not-found/not-found-content";
import { routing } from "@/i18n/routing";
import { SiteDocument } from "@/shared/site-document";

export default function NotFound() {
  const locale = routing.defaultLocale;

  return (
    <SiteDocument locale={locale}>
      <NotFoundContent locale={locale} />
    </SiteDocument>
  );
}

import { hasLocale } from "next-intl";
import { locale as getLocaleParam } from "next/root-params";
import { NotFoundContent } from "@/features/not-found/not-found-content";
import { routing } from "@/i18n/routing";

export default async function NotFound() {
  const locale = await getLocaleParam();
  return (
    <NotFoundContent locale={hasLocale(routing.locales, locale) ? locale : routing.defaultLocale} />
  );
}

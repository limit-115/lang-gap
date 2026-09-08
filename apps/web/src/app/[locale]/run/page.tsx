import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { RunBuilder } from "@/features/run-builder/run-builder";
import { RunBuilderMobileNotice } from "@/features/run-builder/mobile-notice";
import { getRunDatasets } from "@/features/run-builder/data";
import { routing } from "@/i18n/routing";
import { getMessagesForLocale } from "@/i18n/messages";
import { pageMetadata } from "@/shared/metadata";

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "RunBuilder" });
  return pageMetadata(locale, "/run", t("metadataTitle"), t("intro"));
}
export default async function RunPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const datasets = await getRunDatasets();
  return (
    <NextIntlClientProvider messages={{ RunBuilder: getMessagesForLocale(locale).RunBuilder }}>
      <RunBuilderMobileNotice />
      <div className="hidden md:block">
        <RunBuilder datasets={datasets} />
      </div>
    </NextIntlClientProvider>
  );
}

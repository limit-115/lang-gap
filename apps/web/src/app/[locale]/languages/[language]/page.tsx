import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getModelGuide } from "@/features/leaderboard/guide-data";
import { languageData } from "@/features/languages/data";
import { pageMetadata } from "@/shared/metadata";
import { routing } from "@/i18n/routing";
import { getMessagesForLocale } from "@/i18n/messages";
import { LanguageConcepts } from "@/features/languages/language-concepts";

function languageLabel(language: string, locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(language) ?? language;
  } catch {
    return language;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; language: string }>;
}): Promise<Metadata> {
  const { locale, language } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Languages" });
  const name = languageLabel(language, locale);
  return pageMetadata(
    locale,
    `/languages/${encodeURIComponent(language)}`,
    t("metadataTitle", { language: name }),
    t("intro", { language: name }),
  );
}

export default async function LanguagePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; language: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale, language } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { view } = await searchParams;
  const version = view === "compare" ? "compare" : "shortlist";
  const data = languageData(await getModelGuide());
  const messages = getMessagesForLocale(locale);
  return (
    <NextIntlClientProvider
      messages={{ Languages: messages.Languages, Leaderboard: messages.Leaderboard }}
    >
      <LanguageConcepts
        key={`${language}/${version}`}
        language={language}
        version={version}
        data={data}
        languageNames={Object.fromEntries(
          [...data.languages, language].map((tag) => [tag, languageLabel(tag, locale)]),
        )}
        nativeName={languageLabel(language, language)}
      />
    </NextIntlClientProvider>
  );
}

import { languageLabel } from "@/shared/language-label";
export function getLanguageOptions(languages: readonly string[], locale: string) {
  return [...new Set(languages)]
    .map((value) => ({
      value,
      label: languageLabel(value, locale),
      englishName: languageLabel(value, "en"),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale) || a.value.localeCompare(b.value));
}

export type LanguageOption = ReturnType<typeof getLanguageOptions>[number];

export function matchesLanguage(item: LanguageOption, query: string) {
  const haystack = `${item.label} ${item.englishName} ${item.value}`.toLowerCase();
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export function getLanguageHref(option: Pick<LanguageOption, "value">) {
  return `/languages/${encodeURIComponent(option.value)}`;
}

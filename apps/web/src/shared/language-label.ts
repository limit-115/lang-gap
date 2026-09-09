export function languageLabel(language: string, locale: string) {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(language);
    if (!name || name === language) return language;
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch {
    return language;
  }
}

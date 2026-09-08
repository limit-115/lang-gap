"use client";

import { useId, useMemo, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ArrowRight, ChevronDown, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  getLanguageOptions,
  getLanguageHref,
  matchesLanguage,
  type LanguageOption,
} from "./language-catalog";
import styles from "./model-finder.module.css";

export function LanguageFinder({
  languages,
  compact = false,
}: {
  languages: readonly string[];
  compact?: boolean;
}) {
  const t = useTranslations("Leaderboard");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const options = useMemo(() => getLanguageOptions(languages, locale), [languages, locale]);
  const [selected, setSelected] = useState<LanguageOption | null>(null);
  const [input, setInput] = useState("");

  function selectLanguage(language: LanguageOption | null) {
    setSelected(language);
    if (language) router.push(getLanguageHref(language));
  }

  return (
    <aside className={styles.finder} data-compact={compact} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={compact ? "sr-only" : styles.heading}>
        {t("languageFinderTitle")}
      </h2>
      <p id={`${id}-help`} className="sr-only">
        {t("languageFinderNavigationHelp")}
      </p>
      <div className={styles.controls}>
        <Combobox.Root
          items={options}
          value={selected}
          onValueChange={selectLanguage}
          inputValue={input}
          onInputValueChange={setInput}
          filter={matchesLanguage}
          autoHighlight
        >
          <Combobox.InputGroup className={styles.searchField}>
            <Search aria-hidden="true" className={styles.searchIcon} />
            <Combobox.Input
              id={`${id}-input`}
              aria-labelledby={`${id}-title`}
              aria-describedby={`${id}-help`}
              placeholder={t("languageFinderSearch")}
              className={styles.input}
            />
            <Combobox.Trigger
              id={`${id}-toggle`}
              className={styles.searchToggle}
              aria-label={t("languageFinderBrowse")}
            >
              <ChevronDown aria-hidden="true" />
            </Combobox.Trigger>
          </Combobox.InputGroup>
          <Combobox.Portal>
            <Combobox.Positioner
              side="bottom"
              sideOffset={8}
              align="start"
              className={styles.positioner}
            >
              <Combobox.Popup className={styles.popup}>
                <Combobox.Empty className={styles.empty}>
                  <strong>{t("languageFinderNoResults")}</strong>
                  <span>{t("languageFinderNoResultsHelp")}</span>
                </Combobox.Empty>
                <Combobox.List className={styles.list}>
                  {(item: LanguageOption) => (
                    <Combobox.Item key={item.value} value={item} className={styles.option}>
                      <span className={styles.optionText}>{item.label}</span>
                      <span className={styles.languageTag}>{item.value}</span>
                      <ArrowRight aria-hidden="true" className={styles.optionArrow} />
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>
    </aside>
  );
}

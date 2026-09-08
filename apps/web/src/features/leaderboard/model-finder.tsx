"use client";

import { useId, useMemo, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Aggregate } from "@llang-gap/contracts";
import { useRouter } from "@/i18n/navigation";
import { SearchComboboxInput } from "@/components/ui/search-input";
import {
  getModelOptions,
  getModelHref,
  matchesModel,
  getModelGroups,
  type ModelOption,
} from "./model-catalog";
import { ModelOwnerLogo } from "./model-owner-logo";
import { LanguageFinder } from "./language-finder";
import styles from "./model-finder.module.css";

export function ModelFinderHero({
  rows,
  languages,
}: {
  rows: Pick<Aggregate, "model" | "transport">[];
  languages: readonly string[];
}) {
  const t = useTranslations("Leaderboard");
  return (
    <div className={styles.hero}>
      <section className={`intro ${styles.intro}`}>
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
      </section>
      <div className={styles.finders}>
        <ModelFinder rows={rows} />
        <LanguageFinder languages={languages} />
      </div>
    </div>
  );
}

export function ModelFinder({
  rows,
  compact = false,
  language,
}: {
  rows: Pick<Aggregate, "model" | "transport">[];
  compact?: boolean;
  language?: string | null;
}) {
  const t = useTranslations("Leaderboard");
  const router = useRouter();
  const id = useId();
  const options = useMemo(() => getModelOptions(rows), [rows]);
  const groups = useMemo(() => getModelGroups(options), [options]);
  const [selected, setSelected] = useState<ModelOption | null>(null);
  const [input, setInput] = useState("");

  function selectModel(model: ModelOption | null) {
    setSelected(model);
    if (model)
      router.push(
        `${getModelHref(model)}${language ? `?language=${encodeURIComponent(language)}` : ""}`,
      );
  }

  return (
    <aside className={styles.finder} data-compact={compact} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={compact ? "sr-only" : styles.heading}>
        {t("finderTitle")}
      </h2>
      <p id={`${id}-help`} className="sr-only">
        {t("finderNavigationHelp")}
      </p>
      <div className={styles.controls}>
        <Combobox.Root
          items={groups}
          value={selected}
          onValueChange={selectModel}
          inputValue={input}
          onInputValueChange={setInput}
          filter={matchesModel}
          autoHighlight
        >
          <SearchComboboxInput
            id={`${id}-input`}
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-help`}
            placeholder={t("finderSearch")}
            toggleLabel={t("finderBrowse")}
          />
          <Combobox.Portal>
            <Combobox.Positioner
              side="bottom"
              sideOffset={8}
              align="start"
              className={styles.positioner}
            >
              <Combobox.Popup className={styles.popup}>
                <Combobox.Empty className={styles.empty}>
                  <strong>{t("finderNoResults")}</strong>
                  <span>{t("finderNoResultsHelp")}</span>
                </Combobox.Empty>
                <Combobox.List className={styles.list}>
                  {(group: (typeof groups)[number]) => (
                    <Combobox.Group key={group.value} items={group.items} className={styles.group}>
                      <Combobox.GroupLabel className={styles.groupLabel}>
                        {group.label}
                      </Combobox.GroupLabel>
                      <Combobox.Collection>
                        {(item: ModelOption) => (
                          <Combobox.Item key={item.value} value={item} className={styles.option}>
                            <span className={styles.ownerIcon} aria-hidden="true">
                              <ModelOwnerLogo ownerId={item.ownerId} size={18} />
                            </span>
                            <span className={styles.optionText}>{item.label}</span>
                            <ArrowRight aria-hidden="true" className={styles.optionArrow} />
                          </Combobox.Item>
                        )}
                      </Combobox.Collection>
                    </Combobox.Group>
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

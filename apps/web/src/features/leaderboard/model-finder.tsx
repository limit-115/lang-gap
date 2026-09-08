"use client";

import { useId, useMemo, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ArrowRight, ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Aggregate } from "@llang-gap/contracts";
import { useRouter } from "@/i18n/navigation";
import {
  getModelOptions,
  getModelHref,
  matchesModel,
  getModelGroups,
  type ModelOption,
} from "./model-catalog";
import { ModelOwnerLogo } from "./model-owner-logo";
import styles from "./model-finder.module.css";

export function ModelFinderHero({ rows }: { rows: Pick<Aggregate, "model" | "transport">[] }) {
  const t = useTranslations("Leaderboard");
  const router = useRouter();
  const id = useId();
  const options = useMemo(() => getModelOptions(rows), [rows]);
  const groups = useMemo(() => getModelGroups(options), [options]);
  const [selected, setSelected] = useState<ModelOption | null>(null);
  const [input, setInput] = useState("");

  function selectModel(model: ModelOption | null) {
    setSelected(model);
    if (model) router.push(getModelHref(model));
  }

  return (
    <div className={styles.hero}>
      <section className={`intro ${styles.intro}`}>
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
      </section>
      <aside className={styles.finder} aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`} className={styles.heading}>
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
            <Combobox.InputGroup className={styles.searchField}>
              <Search aria-hidden="true" className={styles.searchIcon} />
              <Combobox.Input
                id={`${id}-input`}
                aria-labelledby={`${id}-title`}
                aria-describedby={`${id}-help`}
                placeholder={t("finderSearch")}
                className={styles.input}
              />
              <Combobox.Trigger
                id={`${id}-toggle`}
                className={styles.searchToggle}
                aria-label={t("finderBrowse")}
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
                    <strong>{t("finderNoResults")}</strong>
                    <span>{t("finderNoResultsHelp")}</span>
                  </Combobox.Empty>
                  <Combobox.List className={styles.list}>
                    {(group: (typeof groups)[number]) => (
                      <Combobox.Group
                        key={group.value}
                        items={group.items}
                        className={styles.group}
                      >
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
    </div>
  );
}

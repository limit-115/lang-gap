"use client";

import { useId, useMemo, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ArrowRight, Check, ChevronDown, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Aggregate } from "@llang-gap/contracts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  getModelOptions,
  getModelHref,
  matchesModel,
  plannedRows,
  providerNames,
  type ModelOption,
} from "./model-catalog";
import styles from "./model-finder.module.css";

export function ModelFinderHero({ rows }: { rows: Aggregate[] }) {
  const t = useTranslations("Leaderboard");
  const id = useId();
  const options = useMemo(() => getModelOptions(rows.length ? rows : plannedRows), [rows]);
  const [selected, setSelected] = useState<ModelOption | null>(null);
  const [input, setInput] = useState("");
  const groups = useMemo(
    () =>
      Object.entries(providerNames)
        .map(([provider, label]) => ({
          value: provider,
          label,
          items: options.filter((option) => option.provider === provider),
        }))
        .filter((group) => group.items.length > 0),
    [options],
  );

  return (
    <div className={styles.hero}>
      <section className={`intro ${styles.intro}`}>
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
      </section>
      <aside className={styles.card} aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`} className={styles.cardHeading}>
          {t("finderTitle")}
        </h2>
        <div className={styles.controls}>
          <Combobox.Root
            items={groups}
            value={selected}
            onValueChange={setSelected}
            inputValue={input}
            onInputValueChange={setInput}
            onOpenChange={() => setInput("")}
            filter={matchesModel}
            autoHighlight
          >
            <div className={styles.selection}>
              <Combobox.Trigger className={styles.trigger} aria-label={t("finderSelect")}>
                {selected ? (
                  <>
                    <span className={styles.providerIcon} aria-hidden="true">
                      {providerNames[selected.provider].slice(0, 1)}
                    </span>
                    <span className={styles.selectedName}>{selected.label}</span>
                    {!rows.length && <span className={styles.planned}>{t("planned")}</span>}
                  </>
                ) : (
                  <span className={styles.placeholder}>{t("finderSelect")}</span>
                )}
                <ChevronDown aria-hidden="true" className={styles.chevron} />
              </Combobox.Trigger>
              {selected && (
                <button
                  type="button"
                  className={styles.clearButton}
                  aria-label={t("finderClear")}
                  onClick={() => setSelected(null)}
                >
                  <X aria-hidden="true" />
                </button>
              )}
            </div>
            <Combobox.Portal>
              <Combobox.Positioner
                side="bottom"
                sideOffset={8}
                align="start"
                className={styles.positioner}
              >
                <Combobox.Popup className={styles.popup}>
                  <Combobox.InputGroup className={styles.inputGroup}>
                    <Search aria-hidden="true" className={styles.searchIcon} />
                    <Combobox.Input
                      aria-label={t("finderPlaceholder")}
                      placeholder={t("finderPlaceholder")}
                      className={styles.input}
                    />
                  </Combobox.InputGroup>
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
                              <span className={styles.providerIcon} aria-hidden="true">
                                {providerNames[item.provider].slice(0, 1)}
                              </span>
                              <span className={styles.optionText}>{item.label}</span>
                              {!rows.length && (
                                <span className={styles.planned}>{t("planned")}</span>
                              )}
                              <Combobox.ItemIndicator className={styles.check}>
                                <Check aria-hidden="true" />
                              </Combobox.ItemIndicator>
                            </Combobox.Item>
                          )}
                        </Combobox.Collection>
                      </Combobox.Group>
                    )}
                  </Combobox.List>
                  <div className={styles.listFooter}>{t("finderListHelp")}</div>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          {selected ? (
            <Link
              href={getModelHref(selected)}
              prefetch={false}
              className={`${buttonVariants()} ${styles.action}`}
            >
              {t("finderAction")} <ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            <Button disabled className={styles.action}>
              {t("finderAction")} <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}

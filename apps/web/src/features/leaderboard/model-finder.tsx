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
  const canContinue = selected !== null && input === selected.label;

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
            items={options}
            value={selected}
            onValueChange={setSelected}
            inputValue={input}
            onInputValueChange={setInput}
            filter={matchesModel}
            autoHighlight
          >
            <label htmlFor={`${id}-input`} className="sr-only">
              {t("finderSelect")}
            </label>
            <Combobox.InputGroup className={styles.inputGroup}>
              <Search aria-hidden="true" className={styles.searchIcon} />
              <Combobox.Input
                id={`${id}-input`}
                placeholder={t("finderPlaceholder")}
                className={styles.input}
              />
              {input && (
                <Combobox.Clear className={styles.inputButton} aria-label={t("finderClear")}>
                  <X aria-hidden="true" />
                </Combobox.Clear>
              )}
              <Combobox.Trigger className={styles.inputButton} aria-label={t("finderBrowse")}>
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
                    {(item: ModelOption) => (
                      <Combobox.Item key={item.value} value={item} className={styles.option}>
                        <span className={styles.providerIcon} aria-hidden="true">
                          {providerNames[item.provider].slice(0, 1)}
                        </span>
                        <span className={styles.optionText}>
                          <strong>{item.label}</strong>
                          <span>{providerNames[item.provider]}</span>
                        </span>
                        {!rows.length && <span className={styles.planned}>{t("planned")}</span>}
                        <Combobox.ItemIndicator className={styles.check}>
                          <Check aria-hidden="true" />
                        </Combobox.ItemIndicator>
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                  <div className={styles.listFooter}>{t("finderListHelp")}</div>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          {canContinue ? (
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

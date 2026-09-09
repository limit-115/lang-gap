"use client";

import { languageLabel } from "@/shared/language-label";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Database,
  Globe2,
  Layers,
  Monitor,
  Search,
  SlidersHorizontal,
  Terminal,
  Zap,
} from "lucide-react";
import { effortSchema, transportSchema } from "@llang-gap/contracts";
import type { RunDataset } from "@llang-gap/contracts/run-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildRun,
  initialSettings,
  selectRunDataset,
  pricingFields,
  type RunSettings,
  type Setting,
} from "./config";
import { getLanguageChoices, getQuestionRange } from "./language-selection";
import { ProviderLogo } from "./provider-logo";
import styles from "./run-builder.module.css";

const transportNames = { openai: "OpenAI", anthropic: "Anthropic", openrouter: "OpenRouter" };
const sections = ["datasetSection", "modelSection", "sizeSection"] as const;
const sectionFields: Setting[][] = [
  ["dataset", "protocol", "languages"],
  ["transport", "models", "efforts", "maxOutputTokens"],
  ["scope", "questionLimit", "repeats"],
];
const basicFields = new Set(sectionFields.flat());

export function RunBuilder({ datasets }: { datasets: RunDataset[] }) {
  const t = useTranslations("RunBuilder");
  const locale = useLocale();
  const [settings, setSettings] = useState(initialSettings);
  const [touched, setTouched] = useState<Partial<Record<Setting, boolean>>>({});
  const [mode, setMode] = useState<"run" | "plan">("run");
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const [step, setStep] = useState(0);
  const [confirmedSteps, setConfirmedSteps] = useState<number[]>([]);
  const [languageSearch, setLanguageSearch] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const result = buildRun(settings, datasets);
  const dataset = datasets.find((entry) => entry.id === settings.dataset);
  const protocol = dataset?.protocols.find((entry) => entry.id === settings.protocol);
  const command = mode === "run" ? result.command : result.plan;
  const validSections = sectionFields.map(
    (fields, index) =>
      !fields.some((key) => result.errors[key]) &&
      (index !== 2 || !Object.keys(result.errors).some((key) => !basicFields.has(key as Setting))),
  );
  const completed = validSections.map((valid, index) => valid && confirmedSteps.includes(index));
  const modelCount = settings.models
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean).length;
  const nextStep = validSections.findIndex((done) => !done);
  const languageChoices = getLanguageChoices(dataset, settings.protocol, settings.languages);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(""), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  function update<K extends Setting>(key: K, value: RunSettings[K]) {
    setSettings((previous) => ({ ...previous, [key]: value }));
    setTouched((previous) => ({ ...previous, [key]: true }));
    setCopyError(false);
  }
  const error = (key: Setting) => touched[key] && result.errors[key];
  function field(key: Setting, control: ReactNode, hint?: ReactNode) {
    const issue = error(key);
    return (
      <div className={styles.field} data-field={key}>
        <label htmlFor={`run-${key}`}>{t(key)}</label>
        {control}
        {hint && (
          <p id={`run-${key}-hint`} className={styles.hint}>
            {hint}
          </p>
        )}
        {issue && (
          <output id={`run-${key}-error`} className={styles.error}>
            {t(issue)}
          </output>
        )}
      </div>
    );
  }
  function textInput(
    key: Setting,
    options: {
      type?: string;
      min?: number;
      max?: number;
      placeholder?: string;
      hint?: ReactNode;
      readOnly?: boolean;
      step?: string;
    } = {},
  ) {
    return field(
      key,
      <Input
        id={`run-${key}`}
        value={String(settings[key])}
        type={options.type ?? "text"}
        min={options.min}
        max={options.max}
        step={options.step}
        readOnly={options.readOnly}
        placeholder={options.placeholder}
        className={styles.input}
        aria-invalid={Boolean(error(key))}
        aria-describedby={
          [options.hint ? `run-${key}-hint` : "", error(key) ? `run-${key}-error` : ""]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onChange={(event) => update(key, event.target.value)}
      />,
      options.hint,
    );
  }
  function select(
    key: "dataset" | "protocol" | "transport",
    value: string,
    choices: { value: string; label: string }[],
    onChange: (value: string) => void,
    hint?: string,
  ) {
    return field(
      key,
      <Select
        value={value || null}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
        items={choices}
      >
        <SelectTrigger
          id={`run-${key}`}
          className={styles.input}
          disabled={!choices.length}
          aria-invalid={Boolean(error(key))}
          aria-describedby={
            `${hint ? `run-${key}-hint` : ""} ${error(key) ? `run-${key}-error` : ""}`.trim() ||
            undefined
          }
        >
          <SelectValue placeholder={t(`${key}Placeholder`)} />
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          <SelectGroup>
            {choices.map((choice) => (
              <SelectItem key={choice.value} value={choice.value}>
                {choice.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>,
      hint,
    );
  }
  function choice(key: "languages" | "efforts", value: string, label: ReactNode, disabled = false) {
    const selected = (settings[key] as string[]).includes(value);
    return (
      <label
        key={value}
        className={styles.choice}
        data-selected={selected}
        data-disabled={disabled}
      >
        <input
          type="checkbox"
          checked={selected}
          disabled={disabled}
          onChange={() => {
            if (key === "efforts") {
              const effort = effortSchema.parse(value);
              update(
                key,
                selected
                  ? settings.efforts.filter((entry) => entry !== effort)
                  : [...settings.efforts, effort],
              );
            } else
              update(
                key,
                selected
                  ? settings.languages.filter((entry) => entry !== value)
                  : [...settings.languages, value],
              );
          }}
        />
        {label}
      </label>
    );
  }
  async function copyCommand() {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(command);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }

  function changeDataset(value: string) {
    const next = datasets.find((entry) => entry.id === value);
    if (!next) return;
    setSettings((previous) => selectRunDataset(previous, next));
    setLanguageSearch("");
    setTouched((previous) => ({
      ...previous,
      dataset: true,
      protocol: false,
      languages: false,
      comparisons: false,
      maxOutputTokens: false,
    }));
  }
  function goToSection(index: number) {
    setStep(index);
    requestAnimationFrame(() => {
      const target = contentRef.current;
      target?.scrollTo({ top: 0, behavior: "instant" });
      target?.focus({ preventScroll: true });
    });
  }
  function continueStep() {
    const fields =
      step === 2
        ? (Object.keys(result.errors).filter(
            (key) =>
              !sectionFields[0]!.includes(key as Setting) &&
              !sectionFields[1]!.includes(key as Setting),
          ) as Setting[])
        : (sectionFields[step] ?? []);
    setTouched((previous) => ({
      ...previous,
      ...Object.fromEntries(fields.map((key) => [key, true])),
    }));
    if (fields.some((key) => result.errors[key])) {
      if (fields.some((key) => !basicFields.has(key))) setAdvancedOpen(true);
      requestAnimationFrame(() =>
        contentRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"], input:invalid')
          ?.focus(),
      );
      return;
    }
    setConfirmedSteps((previous) => (previous.includes(step) ? previous : [...previous, step]));
    goToSection(Math.min(step + 1, 3));
  }
  function datasetQuestionSummary(entry: RunDataset) {
    const range = getQuestionRange(entry.languages);
    if (!range) return "";
    return range.min === range.max
      ? t("datasetQuestions", { count: range.min })
      : t("datasetQuestionRange", { min: range.min, max: range.max });
  }
  const datasetFields = (
    <>
      <fieldset className={styles.field}>
        <legend>{t("dataset")}</legend>
        <div className={styles.datasetCards}>
          {datasets.map((entry) => (
            <label
              key={entry.id}
              className={styles.datasetCard}
              data-selected={settings.dataset === entry.id}
            >
              <input
                type="radio"
                name="run-dataset"
                checked={settings.dataset === entry.id}
                onChange={() => changeDataset(entry.id)}
              />
              <Database aria-hidden="true" />
              <span>
                <strong>{entry.id}</strong>
                <small>
                  {t("datasetDetails", {
                    languages: entry.languages.length,
                    questions: datasetQuestionSummary(entry),
                  })}
                </small>
              </span>
              <span className={styles.radioMark} />
            </label>
          ))}
        </div>
        {error("dataset") && <output className={styles.error}>{t("required")}</output>}
      </fieldset>
      {dataset &&
        select(
          "protocol",
          settings.protocol,
          dataset.protocols.map((entry) => ({
            value: entry.id,
            label:
              entry.id === dataset.recommendedProtocol
                ? t("recommendedProtocol", { name: t(`protocols.${entry.id}`) })
                : t(`protocols.${entry.id}`),
          })),
          (value) => {
            const next = dataset.protocols.find((entry) => entry.id === value)!;
            setSettings((previous) => ({
              ...previous,
              protocol: value,
              maxOutputTokens: next.tokenCap?.toString() ?? previous.maxOutputTokens,
              languages: previous.languages.filter((language) => next.languages.includes(language)),
              comparisons: "",
            }));
            setTouched((previous) => ({
              ...previous,
              protocol: true,
              maxOutputTokens: next.requiresTokenCap,
              comparisons: false,
            }));
          },
          t("protocolShortHint"),
        )}
      <fieldset className={styles.field} aria-describedby="run-languages-hint">
        <legend>
          {t("languages")}
          {settings.languages.length > 0 && (
            <span className={styles.countBadge}>{settings.languages.length}</span>
          )}
        </legend>
        {dataset ? (
          <>
            <div className={styles.languageToolbar}>
              <span>
                {t("selectedLanguages", {
                  count: settings.languages.length,
                  total: languageChoices.tags.length,
                })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={!languageChoices.tags.length}
                onClick={() =>
                  update("languages", languageChoices.allSelected ? [] : languageChoices.tags)
                }
              >
                {t(languageChoices.allSelected ? "clearLanguages" : "selectAllLanguages")}
              </Button>
            </div>
            {dataset.languages.length > 6 && (
              <div className={styles.search}>
                <Search aria-hidden="true" />
                <Input
                  aria-label={t("searchLanguages")}
                  placeholder={t("searchLanguages")}
                  value={languageSearch}
                  onChange={(event) => setLanguageSearch(event.target.value)}
                />
              </div>
            )}
            <div className={styles.languageChoices}>
              {dataset.languages
                .filter(({ tag }) =>
                  `${languageLabel(tag, locale)} ${tag}`
                    .toLocaleLowerCase(locale)
                    .includes(languageSearch.toLocaleLowerCase(locale)),
                )
                .map(({ tag }) =>
                  choice(
                    "languages",
                    tag,
                    <span>
                      {languageLabel(tag, locale)}
                      <span className={styles.tag}>{tag}</span>
                    </span>,
                    !protocol?.languages.includes(tag),
                  ),
                )}
            </div>
            {!dataset.languages.some(({ tag }) =>
              `${languageLabel(tag, locale)} ${tag}`
                .toLocaleLowerCase(locale)
                .includes(languageSearch.toLocaleLowerCase(locale)),
            ) && <p className={styles.hint}>{t("noLanguagesFound")}</p>}
          </>
        ) : (
          <div className={styles.languageEmpty}>
            <Globe2 aria-hidden="true" />
            <span>{t("chooseDatasetFirst")}</span>
          </div>
        )}
        <p id="run-languages-hint" className={styles.hint}>
          {t("languagesHint")}
        </p>
        {error("languages") && (
          <output className={styles.error}>{t(result.errors.languages!)}</output>
        )}
      </fieldset>
    </>
  );
  const modelFields = (
    <>
      <fieldset className={styles.field}>
        <legend>{t("provider")}</legend>
        <div className={styles.providers}>
          {transportSchema.options.map((value) => (
            <label
              key={value}
              className={styles.provider}
              data-selected={settings.transport === value}
            >
              <input
                type="radio"
                name="run-transport"
                checked={settings.transport === value}
                onChange={() => {
                  update("transport", value);
                  update("models", value === "fake" ? "fake-one" : "");
                  setTouched((previous) => ({ ...previous, models: false }));
                }}
              />
              <span className={styles.providerMark}>
                <ProviderLogo provider={value} />
              </span>
              <span>{value === "fake" ? t("testProvider") : transportNames[value]}</span>
            </label>
          ))}
        </div>
        {error("transport") && <output className={styles.error}>{t("required")}</output>}
      </fieldset>
      {textInput("models", {
        placeholder:
          settings.transport === "openrouter"
            ? "owner/model, owner/another-model"
            : settings.transport === "fake"
              ? "fake-one, fake-two"
              : t("modelsPlaceholder"),
        hint: t("modelsHint"),
      })}
      <fieldset className={styles.field} aria-describedby="run-efforts-hint">
        <legend>{t("efforts")}</legend>
        <div className={styles.effortChoices}>
          {effortSchema.options.map((effort) => choice("efforts", effort, t(effort)))}
        </div>
        <p id="run-efforts-hint" className={styles.hint}>
          {t("effortsHint")}
        </p>
        {error("efforts") && <output className={styles.error}>{t("required")}</output>}
      </fieldset>
      {textInput("maxOutputTokens", {
        type: "number",
        min: 256,
        max: 128000,
        placeholder: t("capPlaceholder"),
        readOnly: protocol?.tokenCap != null,
        hint:
          protocol?.tokenCap != null ? t("capPinned", { count: protocol.tokenCap }) : t("capHint"),
      })}
      {settings.transport === "anthropic" && !settings.maxOutputTokens && (
        <p className={styles.error}>{t("capRequired")}</p>
      )}
    </>
  );
  const executionFields = (
    <>
      <fieldset className={styles.field} aria-describedby="run-scope-hint">
        <legend>{t("scope")}</legend>
        <div className={styles.scopeChoices}>
          {(["sample", "all"] as const).map((scope) => (
            <label
              key={scope}
              className={styles.scopeChoice}
              data-selected={settings.scope === scope}
            >
              <input
                type="radio"
                name="run-scope"
                checked={settings.scope === scope}
                onChange={() => update("scope", scope)}
              />
              {scope === "sample" ? <Zap aria-hidden="true" /> : <Database aria-hidden="true" />}
              <span>
                <strong>{t(scope)}</strong>
                <small>{t(scope === "sample" ? "sampleDescription" : "allDescription")}</small>
              </span>
              <span className={styles.radioMark} />
            </label>
          ))}
        </div>
        <p id="run-scope-hint" className={styles.hint}>
          {t("scopeHint")}
        </p>
      </fieldset>
      <div className={styles.grid}>
        {settings.scope === "sample" && textInput("questionLimit", { type: "number", min: 1 })}
        {textInput("repeats", { type: "number", min: 1, max: 10, hint: t("repeatsHint") })}
      </div>
    </>
  );
  const advanced = (
    <details
      className={styles.advanced}
      open={advancedOpen}
      onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
    >
      <summary>
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        <span>
          {t("advanced")}
          <small>{t("advancedHint")}</small>
        </span>
        <ChevronDown aria-hidden="true" className={styles.chevron} />
      </summary>
      <div className={styles.advancedBody}>
        {textInput("comparisons", {
          placeholder: t("comparisonsPlaceholder"),
          hint: t("comparisonsHint"),
        })}
        <div className={styles.grid}>
          {textInput("id")}
          {textInput("seed", {
            type: "number",
            min: 1,
            max: 2147483647,
            hint: "1–2,147,483,647",
          })}
          {textInput("concurrency", { type: "number", min: 1, max: 32, hint: "1–32" })}
          {textInput("maxAttempts", { type: "number", min: 1, max: 5, hint: "1–5" })}
          {textInput("timeoutMs", {
            type: "number",
            min: 1000,
            max: 3600000,
            hint: "1,000–3,600,000",
          })}
          {textInput("maxJobs", { type: "number", min: 1, placeholder: t("optional") })}
        </div>
        <p className={styles.hint}>{t("maxJobsHint")}</p>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={settings.offline}
            onChange={(event) => update("offline", event.target.checked)}
          />
          {t("offline")}
        </label>
        <p className={styles.hint}>{t("offlineHint")}</p>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={settings.pricing}
            onChange={(event) => update("pricing", event.target.checked)}
          />
          {t("pricing")}
        </label>
        <p className={styles.hint}>{t("pricingHint")}</p>
        {settings.pricing && (
          <>
            <div className={styles.grid}>
              {textInput("pricingAsOf", { type: "date" })}
              {textInput("pricingSource", { type: "url", placeholder: "https://…" })}
              {pricingFields.map((key) => (
                <div key={key}>{textInput(key, { type: "number", min: 0, step: "any" })}</div>
              ))}
            </div>
            {result.errors.pricing && (
              <output className={styles.error}>{t(result.errors.pricing)}</output>
            )}
          </>
        )}
      </div>
    </details>
  );
  const panels = [datasetFields, modelFields, executionFields];
  const steps = [...sections, "reviewSection"] as const;
  const summaryRows = [
    { label: t("dataset"), value: settings.dataset || t("notSelected"), index: 0 },
    {
      label: t("languages"),
      value: settings.languages.length
        ? settings.languages.length > 3
          ? t("languageSelectionSummary", { count: settings.languages.length })
          : settings.languages.map((tag) => languageLabel(tag, locale)).join(", ")
        : t("notSelected"),
      index: 0,
    },
    {
      label: t("models"),
      value: modelCount
        ? t("modelConditions", { models: modelCount, efforts: settings.efforts.length })
        : t("notSelected"),
      index: 1,
    },
    {
      label: t("scope"),
      value:
        settings.scope === "all"
          ? t("all")
          : t("sampleSummary", { count: Number(settings.questionLimit) || 0 }),
      index: 2,
    },
  ];
  const commandPanel = (
    <div className={styles.terminal}>
      <div className={styles.terminalHeader}>
        <Terminal aria-hidden="true" />
        <span>{t("commandTitle")}</span>
        <span className={styles.shellBadge}>bash / zsh</span>
      </div>
      <fieldset className={styles.mode} aria-label={t("commandMode")}>
        {(["run", "plan"] as const).map((value) => (
          <Button
            key={value}
            variant="ghost"
            aria-pressed={mode === value}
            onClick={() => {
              setMode(value);
              setCopyError(false);
            }}
          >
            {t(value)}
          </Button>
        ))}
      </fieldset>
      <div className={styles.commandArea}>
        <textarea
          readOnly
          aria-label={t("commandTitle")}
          value={command ?? ""}
          rows={Math.min(14, Math.max(6, (command ?? "").split("\n").length + 1))}
          spellCheck={false}
        />
      </div>
    </div>
  );
  const output = (
    <aside className={styles.output} aria-label={t("summaryTitle")}>
      <div className={styles.summaryCard}>
        <div className={styles.requestTotal}>
          <span>
            {result.requests === null
              ? t("requestsTbd")
              : new Intl.NumberFormat(locale).format(result.requests)}
          </span>
          <div>
            <strong>{t("plannedRequests")}</strong>
            <small>{t("beforeRetries")}</small>
          </div>
          <Layers aria-hidden="true" />
        </div>
        <div className={styles.summaryRows}>
          {summaryRows.map((row) => (
            <button key={row.label} onClick={() => goToSection(row.index)}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
              <ChevronDown aria-hidden="true" />
            </button>
          ))}
        </div>
        {settings.transport && settings.transport !== "fake" && (
          <p className={styles.cost}>{t(settings.pricing ? "costConfigured" : "costUnknown")}</p>
        )}
        {!command && (
          <div className={styles.nextAction}>
            <span>{t("nextUp")}</span>
            <button
              onClick={() => {
                goToSection(nextStep < 0 ? 2 : nextStep);
              }}
            >
              {t(sections[nextStep < 0 ? 2 : nextStep]!)}
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        )}
        <div className={styles.commandDisclosure}>
          <Button
            variant="outline"
            className={styles.commandTrigger}
            disabled={!command}
            aria-expanded={Boolean(command) && commandOpen}
            aria-controls="run-command-preview"
            onClick={() => setCommandOpen((open) => !open)}
          >
            <Terminal aria-hidden="true" />
            {t("viewCommand")}
            <ChevronDown aria-hidden="true" />
          </Button>
          {command && commandOpen && <div id="run-command-preview">{commandPanel}</div>}
        </div>
        <Button
          disabled={!command}
          className={styles.primaryAction}
          onClick={() => {
            void copyCommand();
          }}
        >
          {copied === command ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          <span aria-live="polite" aria-atomic="true">
            {t(copied === command ? "copied" : "copy")}
          </span>
        </Button>
        {copyError && <output className={styles.error}>{t("copyError")}</output>}
      </div>
    </aside>
  );
  if (!datasets.length) return <p>{t("noDatasets")}</p>;
  return (
    <div className={styles.page}>
      <div className={styles.guidedLayout}>
        <aside className={styles.guideRail}>
          <div className={styles.guideRailTop}>
            <span className={styles.guideGlyph}>
              <Layers aria-hidden="true" />
            </span>
            <h2>{t("guideRailTitle")}</h2>
            <p>{t("guideRailHint")}</p>
          </div>
          <nav aria-label={t("steps")} className={styles.stepList}>
            {steps.map((label, index) => (
              <button
                key={label}
                aria-current={step === index ? "step" : undefined}
                onClick={() => goToSection(index)}
              >
                <span className={styles.stepIndicator} data-done={index < 3 && completed[index]}>
                  {index < 3 && completed[index] ? <Check aria-hidden="true" /> : index + 1}
                </span>
                <span>
                  {t(label)}
                  <small>{t(`${label}Short`)}</small>
                </span>
                {step === index && <ArrowRight aria-hidden="true" />}
              </button>
            ))}
          </nav>
          <div className={styles.guideAssurance}>
            <Monitor aria-hidden="true" />
            <div>
              <strong>{t("yourMachine")}</strong>
              <p>{t("localNote")}</p>
            </div>
          </div>
        </aside>
        <div className={styles.guidedContent}>
          <div ref={contentRef} tabIndex={-1} className={styles.stepContent}>
            <div className={styles.stepProgress}>
              <span>{t("stepProgress", { current: step + 1, total: 4 })}</span>
              <div>
                {steps.map((label, index) => (
                  <span key={label} data-active={index <= step} />
                ))}
              </div>
            </div>
            {step < 3 ? (
              <>
                <div className={styles.guidedTitle}>
                  <h2>{t(sections[step]!)}</h2>
                  <p>{t(`${sections[step]!}Hint`)}</p>
                </div>
                <div className={styles.sectionBody}>
                  {panels[step]}
                  {step === 2 && advanced}
                </div>
              </>
            ) : (
              <>
                <div className={styles.guidedTitle}>
                  <h2>{t("reviewSection")}</h2>
                  <p>{t("reviewHint")}</p>
                </div>
                {output}
              </>
            )}
          </div>
          <div className={styles.stepFooter}>
            <Button variant="ghost" disabled={step === 0} onClick={() => goToSection(step - 1)}>
              <ArrowLeft aria-hidden="true" />
              {t("back")}
            </Button>
            {step < 3 ? (
              <Button className={styles.continueButton} onClick={continueStep}>
                {t(step === 2 ? "reviewAction" : "continue")}
                <ArrowRight aria-hidden="true" />
              </Button>
            ) : (
              <span className={styles.hint}>{t("localOnly")}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

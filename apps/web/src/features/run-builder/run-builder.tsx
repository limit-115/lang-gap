"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, Check, ChevronDown, Copy, Terminal, SlidersHorizontal } from "lucide-react";
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
import { buildRun, initialSettings, pricingFields, type RunSettings, type Setting } from "./config";
import styles from "./run-builder.module.css";

const transportNames = { openai: "OpenAI", anthropic: "Anthropic", openrouter: "OpenRouter" };
const environmentKeys = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};
const setupCommand =
  "git clone https://github.com/limit-115/llang-gap.git\ncd llang-gap\ncorepack enable\npnpm install --frozen-lockfile";
const basicFields = new Set<Setting>([
  "dataset",
  "protocol",
  "languages",
  "transport",
  "models",
  "efforts",
  "scope",
  "questionLimit",
  "repeats",
  "maxOutputTokens",
]);

export function RunBuilder({ datasets }: { datasets: RunDataset[] }) {
  const t = useTranslations("RunBuilder");
  const locale = useLocale();
  const [settings, setSettings] = useState(initialSettings);
  const [touched, setTouched] = useState<Partial<Record<Setting, boolean>>>({});
  const [mode, setMode] = useState<"run" | "plan">("run");
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const result = buildRun(settings, datasets);
  const dataset = datasets.find((entry) => entry.id === settings.dataset);
  const protocol = dataset?.protocols.find((entry) => entry.id === settings.protocol);
  const command = mode === "run" ? result.command : result.plan;
  const languageNames = new Intl.DisplayNames([locale], { type: "language" });

  function update<K extends Setting>(key: K, value: RunSettings[K]) {
    setSettings((previous) => ({ ...previous, [key]: value }));
    setTouched((previous) => ({ ...previous, [key]: true }));
    setCopyError(false);
  }
  const error = (key: Setting) => touched[key] && result.errors[key];
  function field(key: Setting, control: ReactNode, hint?: ReactNode) {
    const issue = error(key);
    return (
      <div className={styles.field}>
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

  if (!datasets.length) return <p>{t("noDatasets")}</p>;
  return (
    <div className={styles.layout}>
      <div className={styles.settings}>
        <section className={styles.section} aria-labelledby="run-experiment-title">
          <h2 id="run-experiment-title">{t("experimentTitle")}</h2>
          {select(
            "dataset",
            settings.dataset,
            datasets.map((entry) => ({ value: entry.id, label: entry.id })),
            (value) => {
              setSettings((previous) => ({
                ...previous,
                dataset: value,
                protocol: "",
                languages: [],
                comparisons: "",
                maxOutputTokens: "",
              }));
              setTouched((previous) => ({
                ...previous,
                dataset: true,
                protocol: false,
                languages: false,
                comparisons: false,
                maxOutputTokens: false,
              }));
            },
            t("datasetHint"),
          )}
          {select(
            "protocol",
            settings.protocol,
            (dataset?.protocols ?? []).map((entry) => ({
              value: entry.id,
              label: t(`protocols.${entry.id}`),
            })),
            (value) => {
              const next = dataset!.protocols.find((entry) => entry.id === value)!;
              setSettings((previous) => ({
                ...previous,
                protocol: value,
                maxOutputTokens: next.tokenCap?.toString() ?? previous.maxOutputTokens,
                languages: previous.languages.filter((language) =>
                  next.languages.includes(language),
                ),
                comparisons: "",
              }));
              setTouched((previous) => ({
                ...previous,
                protocol: true,
                maxOutputTokens: next.requiresTokenCap,
                comparisons: false,
              }));
            },
            t("protocolHint"),
          )}
          <fieldset className={styles.field} aria-describedby="run-languages-hint">
            <legend>{t("languages")}</legend>
            <div className={styles.choices}>
              {(dataset?.languages ?? []).map(({ tag, questions }) =>
                choice(
                  "languages",
                  tag,
                  <span>
                    {languageNames.of(tag)} <span className={styles.tag}>{tag}</span>
                    <small>{t("languageQuestions", { count: questions })}</small>
                  </span>,
                  !protocol?.languages.includes(tag),
                ),
              )}
            </div>
            <p id="run-languages-hint" className={styles.hint}>
              {t("languagesHint")}
            </p>
            {error("languages") && (
              <output className={styles.error}>{t(result.errors.languages!)}</output>
            )}
          </fieldset>
          {select(
            "transport",
            settings.transport,
            transportSchema.options.map((value) => ({
              value,
              label: value === "fake" ? t("fake") : transportNames[value],
            })),
            (value) => {
              update("transport", transportSchema.parse(value));
              update("models", "");
              setTouched((previous) => ({ ...previous, models: false }));
            },
          )}
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
            <div className={styles.choices}>
              {effortSchema.options.map((effort) => choice("efforts", effort, t(effort)))}
            </div>
            <p id="run-efforts-hint" className={styles.hint}>
              {t("effortsHint")}
            </p>
            {error("efforts") && <output className={styles.error}>{t("required")}</output>}
          </fieldset>
        </section>
        <section className={styles.section} aria-labelledby="run-execution-title">
          <h2 id="run-execution-title">{t("executionTitle")}</h2>
          <fieldset className={styles.field} aria-describedby="run-scope-hint">
            <legend>{t("scope")}</legend>
            <div className={styles.choices}>
              {(["sample", "all"] as const).map((scope) => (
                <label
                  key={scope}
                  className={styles.choice}
                  data-selected={settings.scope === scope}
                >
                  <input
                    type="radio"
                    name="run-scope"
                    value={scope}
                    checked={settings.scope === scope}
                    onChange={() => update("scope", scope)}
                  />
                  {t(scope)}
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
          {textInput("maxOutputTokens", {
            type: "number",
            min: 256,
            max: 128000,
            placeholder: t("capPlaceholder"),
            readOnly: protocol?.tokenCap != null,
            hint:
              protocol?.tokenCap != null
                ? t("capPinned", { count: protocol.tokenCap })
                : t("capHint"),
          })}
          {settings.transport === "anthropic" && !settings.maxOutputTokens && (
            <p className={styles.error}>{t("capRequired")}</p>
          )}
        </section>
        <details className={styles.advanced}>
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
            {textInput("budgetUsd", {
              type: "number",
              min: 0,
              step: "any",
              placeholder: t("optional"),
              hint: t("budgetHint"),
            })}
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
      </div>
      <aside className={styles.output} aria-labelledby="run-command-title">
        <div className={styles.terminal}>
          <div className={styles.terminalHeader}>
            <Terminal aria-hidden="true" className="size-5" />
            <h2 id="run-command-title">{t("commandTitle")}</h2>
          </div>
          <fieldset className={styles.mode} aria-label={t("commandTitle")}>
            <Button
              variant="ghost"
              aria-pressed={mode === "run"}
              onClick={() => {
                setMode("run");
                setCopyError(false);
              }}
            >
              {t("run")}
            </Button>
            <Button
              variant="ghost"
              aria-pressed={mode === "plan"}
              onClick={() => {
                setMode("plan");
                setCopyError(false);
              }}
            >
              {t("plan")}
            </Button>
          </fieldset>
          <div className={styles.commandArea}>
            {command ? (
              <textarea
                readOnly
                aria-label={t("commandTitle")}
                value={command}
                rows={Math.min(18, Math.max(12, command.split("\n").length + 1))}
                spellCheck={false}
              />
            ) : (
              <p className={styles.commandPlaceholder}>
                {Object.values(touched).some(Boolean) ? t("fixErrors") : t("emptyCommand")}
              </p>
            )}
          </div>
          <div className={styles.copyRow}>
            <span>{t("shell")}</span>
            <Button
              onClick={() => {
                void copyCommand();
              }}
              disabled={!command}
              className={styles.copyButton}
            >
              {copied === command ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied === command ? t("copied") : t("copy")}
            </Button>
          </div>
        </div>
        <div aria-live="polite" className={styles.feedback}>
          {copyError ? t("copyError") : copied === command ? t("copied") : ""}
        </div>
        <div className={styles.summary}>
          {result.requests !== null && (
            <>
              <strong>{t("requests", { count: result.requests })}</strong>
              <p>{t("requestsHint")}</p>
            </>
          )}
          <p>
            {mode === "plan"
              ? t("planNote")
              : settings.transport === "fake"
                ? t("fakeNote")
                : t("liveNote")}
          </p>
          {settings.transport && settings.transport !== "fake" && (
            <p className={styles.cost}>{t(settings.pricing ? "costConfigured" : "costUnknown")}</p>
          )}
          {Object.keys(result.errors).some((key) => !basicFields.has(key as Setting)) && (
            <p className={styles.error}>{t("advancedErrors")}</p>
          )}
        </div>
        <details className={styles.setup}>
          <summary>
            {t("setupTitle")}
            <ChevronDown aria-hidden="true" className={styles.chevron} />
          </summary>
          <p>{t("setupIntro")}</p>
          <pre>
            <code>{setupCommand}</code>
          </pre>
          {settings.transport && settings.transport !== "fake" && (
            <p>{t("setupKey", { key: environmentKeys[settings.transport] })}</p>
          )}
          <p>{t("setupRun")}</p>
        </details>
        <a
          href="https://github.com/limit-115/llang-gap/blob/main/docs/runner.md"
          className={styles.docs}
        >
          {t("docs")}
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </a>
      </aside>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, CircleAlert, Copy, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/shared/links/link";

type Props = { citation: string; bibtex: string; url: string; releaseId: string };

function CitationCopyButton({
  text,
  label,
  link = false,
  primary = false,
}: {
  text: string;
  label: string;
  link?: boolean;
  primary?: boolean;
}) {
  const t = useTranslations("Releases");
  const [state, setState] = useState<"idle" | "copying" | "copied" | "error">("idle");

  useEffect(() => {
    if (state !== "copied") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    if (state === "copying") return;
    setState("copying");
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("error");
    }
  }

  const Icon =
    state === "copied" ? Check : state === "error" ? CircleAlert : link ? LinkIcon : Copy;
  const statusLabel = state === "copied" ? t("copied") : state === "error" ? t("copyError") : label;

  return (
    <Button
      variant={primary ? "default" : "outline"}
      aria-disabled={state === "copying"}
      onClick={() => void copy()}
      title={state === "error" ? t("copyFailed") : undefined}
      aria-live="polite"
      aria-atomic="true"
    >
      <Icon aria-hidden="true" />
      <span className="grid">
        {/* Reserve every label's width so feedback never moves adjacent controls. */}
        {[label, t("copied"), t("copyError")].map((text, index) => (
          <span key={index} aria-hidden="true" className="invisible col-start-1 row-start-1">
            {text}
          </span>
        ))}
        <span className="col-start-1 row-start-1">{statusLabel}</span>
      </span>
      {state === "error" && <span className="sr-only">{t("copyFailed")}</span>}
    </Button>
  );
}

export function ReleaseCitation({ citation, bibtex, url, releaseId }: Props) {
  const t = useTranslations("Releases");

  return (
    <section aria-labelledby="release-citation">
      <h2 id="release-citation">{t("citation")}</h2>
      <p>{t("citationHelp")}</p>
      <div className="mt-4 rounded-xl border bg-background p-5">
        <div className="select-text text-sm leading-7 break-words">{citation}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <CitationCopyButton text={citation} label={t("copyCitation")} primary />
          <CitationCopyButton text={url} label={t("copyLink")} link />
        </div>
        <details className="mt-5 border-t pt-4">
          <summary className="w-fit cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4">
            BibTeX
          </summary>
          <pre className="mt-4 select-text rounded-lg bg-muted p-4 font-mono text-xs leading-6 whitespace-pre-wrap break-all">
            {bibtex}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <CitationCopyButton text={bibtex} label={t("copyBibtex")} />
            <ButtonLink
              variant="outline"
              href={`data:application/x-bibtex;charset=utf-8,${encodeURIComponent(bibtex)}`}
              download={`${releaseId}.bib`}
            >
              {t("downloadBibtex")}
            </ButtonLink>
          </div>
        </details>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Download, Link as LinkIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

type Props = { citation: string; bibtex: string; url: string; releaseId: string };

export function ReleaseCitation({ citation, bibtex, url, releaseId }: Props) {
  const t = useTranslations("Releases");
  const [status, setStatus] = useState("");

  async function copy(text: string, message: string) {
    setStatus("");
    try {
      await navigator.clipboard.writeText(text);
      setStatus(message);
    } catch {
      setStatus(t("copyFailed"));
    }
  }

  return (
    <section aria-labelledby="release-citation">
      <h2 id="release-citation">{t("citation")}</h2>
      <p>{t("citationHelp")}</p>
      <div className="mt-4 rounded-xl border bg-background p-5">
        <div className="select-text text-sm leading-7 break-words">{citation}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void copy(citation, t("citationCopied"))}>
            <Copy aria-hidden="true" />
            {t("copyCitation")}
          </Button>
          <Button variant="outline" onClick={() => void copy(url, t("linkCopied"))}>
            <LinkIcon aria-hidden="true" />
            {t("copyLink")}
          </Button>
        </div>
        <details className="mt-5 border-t pt-4">
          <summary className="w-fit cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4">
            BibTeX
          </summary>
          <pre className="mt-4 select-text rounded-lg bg-muted p-4 font-mono text-xs leading-6 whitespace-pre-wrap break-all">
            {bibtex}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void copy(bibtex, t("bibtexCopied"))}>
              <Copy aria-hidden="true" />
              {t("copyBibtex")}
            </Button>
            <a
              className={buttonVariants({ variant: "outline" })}
              href={`data:application/x-bibtex;charset=utf-8,${encodeURIComponent(bibtex)}`}
              download={`${releaseId}.bib`}
            >
              <Download aria-hidden="true" />
              {t("downloadBibtex")}
            </a>
          </div>
        </details>
        <output aria-live="polite" className="mt-3 block min-h-5 text-sm text-muted-foreground">
          {status}
        </output>
      </div>
    </section>
  );
}

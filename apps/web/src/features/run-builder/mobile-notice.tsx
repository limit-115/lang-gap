"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function RunBuilderMobileNotice() {
  const t = useTranslations("RunBuilder");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <section
      aria-labelledby="mobile-run-title"
      className="mx-auto flex max-w-lg flex-col items-start gap-6 py-12 md:hidden"
    >
      <div className="rounded-xl bg-muted p-3">
        <Laptop className="size-8" aria-hidden="true" />
      </div>
      <h1 id="mobile-run-title">{t("mobileTitle")}</h1>
      <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
        <p>{t("mobileDescription")}</p>
        <p>{t("mobileAdvice")}</p>
      </div>
      <div className="w-full space-y-3">
        <Button onClick={() => void copyLink()} className="h-11 w-full rounded-lg">
          <Copy aria-hidden="true" />
          {t("mobileCopyLink")}
        </Button>
        <output className="block text-sm text-muted-foreground">
          {copyState === "copied"
            ? t("mobileLinkCopied")
            : copyState === "error"
              ? t("mobileCopyError")
              : null}
        </output>
      </div>
      <Link href="/" className="text-sm font-medium underline underline-offset-4">
        {t("mobileBrowse")}
      </Link>
    </section>
  );
}

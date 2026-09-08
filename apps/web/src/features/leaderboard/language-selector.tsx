"use client";

import { useState } from "react";
import { ChevronDown, Languages, LockKeyhole, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { withEnglishFirst } from "./table-state";

export function LanguageSelector({
  languages,
  visible,
  onChange,
}: {
  languages: readonly string[];
  visible: readonly string[];
  onChange: (languages: string[]) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("Leaderboard");
  const [search, setSearch] = useState("");
  const available = withEnglishFirst(languages);
  const names = new Intl.DisplayNames([locale], { type: "language" });
  const english = names.of("en") ?? "en";
  const query = search.trim().toLocaleLowerCase(locale);
  const matches = (language: string, label: string) =>
    `${label} ${language}`.toLocaleLowerCase(locale).includes(query);
  const options = available
    .filter((language) => language !== "en")
    .map((language) => ({ language, label: names.of(language) ?? language }))
    .filter(({ language, label }) => matches(language, label));

  function toggleLanguage(language: string, checked: boolean) {
    onChange(
      checked
        ? available.filter((entry) => entry === language || visible.includes(entry))
        : visible.filter((entry) => entry !== language),
    );
  }

  return (
    <DropdownMenu
      modal={false}
      onOpenChange={(open, { trigger }) => {
        if (!open) {
          setSearch("");
          return;
        }
        if (trigger) {
          // Make room for the controls and list without flipping above the trigger.
          const menuSpace = Math.min(320, window.innerHeight / 2);
          const overflow =
            trigger.getBoundingClientRect().bottom + 24 + menuSpace - window.innerHeight;
          if (overflow > 0) window.scrollBy({ top: overflow, behavior: "instant" });
        }
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="group/languages ml-auto gap-2 rounded-lg bg-background font-normal"
          />
        }
      >
        <Languages aria-hidden="true" className="text-muted-foreground" />
        {t("languageColumns")}
        <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
          <span aria-hidden="true">
            {visible.length}/{available.length}
          </span>
          <span className="sr-only">
            {t("visibleLanguages", { count: visible.length, total: available.length })}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 text-muted-foreground transition-transform group-aria-expanded/languages:rotate-180"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={8}
        collisionAvoidance={{ side: "none", align: "shift" }}
        className="flex max-h-[min(30rem,var(--available-height))] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border p-0 shadow-xl ring-0"
      >
        <div className="shrink-0 border-b p-3">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label={t("searchLanguages")}
              placeholder={t("searchLanguages")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") event.stopPropagation();
              }}
              className="h-9 rounded-md border-input bg-background pr-9 pl-9 focus-visible:ring-1"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("clearLanguageSearch")}
                className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md text-muted-foreground"
                onClick={() => setSearch("")}
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <DropdownMenuItem
              className="h-7 flex-1 cursor-pointer justify-center rounded-md border px-2 py-1 text-xs font-normal focus:bg-foreground/5"
              disabled={visible.length === available.length}
              closeOnClick={false}
              onClick={() => onChange(available)}
            >
              {t("selectAllLanguages")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="h-7 flex-1 cursor-pointer justify-center rounded-md border px-2 py-1 text-xs font-normal focus:bg-foreground/5"
              disabled={visible.length === 1}
              closeOnClick={false}
              onClick={() => onChange(withEnglishFirst([]))}
            >
              {t("clearAllLanguages")}
            </DropdownMenuItem>
          </div>
        </div>
        <div className="shrink-0 border-b p-1.5">
          <DropdownMenuCheckboxItem
            indicatorVariant="checkbox"
            checked
            disabled
            className="min-h-9 rounded-md font-normal data-disabled:opacity-100"
          >
            <span>{english}</span>
            <span
              aria-hidden="true"
              className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <LockKeyhole className="size-3" />
              {t("alwaysShown")}
            </span>
          </DropdownMenuCheckboxItem>
        </div>
        <div className="min-h-0 space-y-1 overflow-y-auto p-1.5">
          {options.map(({ language, label }) => (
            <DropdownMenuCheckboxItem
              key={language}
              indicatorVariant="checkbox"
              className="min-h-9 cursor-pointer rounded-md font-normal data-checked:bg-foreground/[0.035] focus:bg-foreground/[0.07]"
              checked={visible.includes(language)}
              onCheckedChange={(checked) => toggleLanguage(language, checked)}
              closeOnClick={false}
            >
              <span>{label}</span>
              <span aria-hidden="true" className="ml-auto text-xs text-muted-foreground">
                {language.toUpperCase()}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
          {options.length === 0 && !matches("en", english) && (
            <output className="block px-3 py-6 text-center text-sm text-muted-foreground">
              {t("noMatchingLanguages")}
            </output>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

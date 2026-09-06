"use client";

import { useTransition } from "react";
import { ChevronDown, Languages, LoaderCircle } from "lucide-react";
import { hasLocale, useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

const languageNames = {
  en: "English",
  ru: "Русский",
} satisfies Record<Locale, string>;

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Navigation");
  const [isPending, startTransition] = useTransition();

  function changeLanguage(value: string) {
    if (value === locale || !hasLocale(routing.locales, value)) return;

    // Read the URL at selection time, including query parameters and in-page anchors.
    const href = `${pathname}${window.location.search}${window.location.hash}`;
    startTransition(() => {
      router.replace(href, { locale: value, scroll: false });
    });
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" />}
        className="language-switch group/language h-9 gap-2 px-3 max-[760px]:h-11"
        aria-label={`${t("language")}: ${locale.toUpperCase()}`}
        aria-busy={isPending}
        disabled={isPending}
      >
        {isPending ? (
          <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
        ) : (
          <Languages aria-hidden="true" className="size-4 text-muted-foreground" />
        )}
        <span>{locale.toUpperCase()}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 text-muted-foreground transition-transform group-aria-expanded/language:rotate-180 motion-reduce:transition-none"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-48 motion-reduce:animate-none"
        aria-label={t("language")}
      >
        <DropdownMenuRadioGroup value={locale} onValueChange={changeLanguage} disabled={isPending}>
          {routing.locales.map((language) => (
            <DropdownMenuRadioItem
              key={language}
              value={language}
              label={languageNames[language]}
              closeOnClick
              className="min-h-11 cursor-pointer gap-3 data-checked:bg-accent [&_[data-slot=dropdown-menu-radio-item-indicator]]:text-primary"
            >
              <span lang={language}>{languageNames[language]}</span>
              <span aria-hidden="true" className="ml-auto text-xs text-muted-foreground">
                {language.toUpperCase()}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

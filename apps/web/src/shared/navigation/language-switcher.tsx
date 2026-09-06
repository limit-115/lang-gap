"use client";

import { useTransition } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
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
        render={<Button variant="ghost" size="sm" />}
        className="language-switch group/language h-9 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground max-[760px]:h-11"
        aria-label={`${t("language")}: ${locale.toUpperCase()}`}
        aria-busy={isPending}
        disabled={isPending}
      >
        <span>{locale.toUpperCase()}</span>
        {isPending ? (
          <LoaderCircle aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
        ) : (
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 transition-transform group-aria-expanded/language:rotate-180 motion-reduce:transition-none"
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-40 min-w-40 rounded-xl p-1 shadow-md ring-border motion-reduce:animate-none"
        aria-label={t("language")}
      >
        <DropdownMenuRadioGroup value={locale} onValueChange={changeLanguage} disabled={isPending}>
          {routing.locales.map((language) => (
            <DropdownMenuRadioItem
              key={language}
              value={language}
              label={languageNames[language]}
              closeOnClick
              className="min-h-9 cursor-pointer rounded-lg pl-3 font-normal data-checked:font-medium max-[760px]:min-h-11 [&_[data-slot=dropdown-menu-radio-item-indicator]]:right-3 [&_[data-slot=dropdown-menu-radio-item-indicator]]:text-foreground"
            >
              <span lang={language}>{languageNames[language]}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

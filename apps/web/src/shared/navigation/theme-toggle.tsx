"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("Navigation");

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative rounded-lg text-muted-foreground max-[760px]:size-11"
      aria-label={t("toggleTheme")}
      title={t("toggleTheme")}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun
        aria-hidden="true"
        className="size-4 scale-100 rotate-0 motion-safe:transition-[rotate,scale] motion-safe:duration-200 dark:scale-0 dark:-rotate-90"
      />
      <Moon
        aria-hidden="true"
        className="absolute size-4 scale-0 rotate-90 motion-safe:transition-[rotate,scale] motion-safe:duration-200 dark:scale-100 dark:rotate-0"
      />
    </Button>
  );
}

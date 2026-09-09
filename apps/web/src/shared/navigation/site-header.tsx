"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandLink, NavLink } from "@/shared/links/link";
import { BrandLogo } from "./brand-logo";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

const pages = [
  { href: "/", label: "leaderboard" },
  { href: "/methodology", label: "methodology" },
  { href: "/releases", label: "releases" },
  { href: "/run", label: "run" },
] as const;

export function SiteHeader() {
  const t = useTranslations("Navigation");
  const [floating, setFloating] = useState(false);

  useEffect(() => {
    const updateFloating = () => {
      // Separate thresholds keep the header stable near the transition point.
      setFloating((previous) => (previous ? window.scrollY > 12 : window.scrollY > 40));
    };

    updateFloating();
    window.addEventListener("scroll", updateFloating, { passive: true });
    return () => window.removeEventListener("scroll", updateFloating);
  }, []);

  return (
    <header className="site-header" data-floating={floating}>
      <div className="header-inner">
        <BrandLink href="/" aria-label={t("home")}>
          <BrandLogo compactOnMobile />
        </BrandLink>
        <nav className="desktop-navigation" aria-label={t("navigation")}>
          {pages.map(({ href, label }) => (
            <NavLink key={href} href={href}>
              {t(label)}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <LanguageSwitcher />
          <div className="mobile-navigation">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-lg" />}
                aria-label={t("menu")}
              >
                <Menu aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={12}
                className="w-60"
                aria-label={t("navigation")}
              >
                {pages.map(({ href, label }) => (
                  <DropdownMenuItem
                    key={href}
                    render={<NavLink href={href} />}
                    className="min-h-11 cursor-pointer aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
                  >
                    {t(label)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}

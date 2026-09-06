"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, usePathname } from "../../i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";

const pages = [
  { href: "/", label: "leaderboard" },
  { href: "/methodology", label: "methodology" },
  { href: "/releases", label: "releases" },
] as const;

export function SiteHeader() {
  const t = useTranslations("Navigation");
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/" aria-label={t("home")}>
          Llang Gap<span className="brand-period">.</span>
        </Link>
        <nav className="desktop-navigation" aria-label={t("navigation")}>
          {pages.map(({ href, label }) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
              {t(label)}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
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
                    render={<Link href={href} />}
                    aria-current={pathname === href ? "page" : undefined}
                    className="min-h-11 cursor-pointer"
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

"use client";

import { cloneElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import NextLink from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Download } from "lucide-react";
import { useLocale } from "next-intl";
import en from "@/shared/links/messages/en";
import ru from "@/shared/links/messages/ru";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Link as LocalizedLink, getPathname, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { isCurrentPage } from "@/shared/navigation/is-current-page";
import styles from "./link.module.css";

type LinkProps = Omit<
  ComponentProps<"a">,
  "href" | "target" | "download" | "dangerouslySetInnerHTML"
> & {
  href: string;
  locale?: Locale;
  newTab?: boolean;
  download?: string;
  prefetch?: boolean;
  scroll?: boolean;
  replace?: boolean;
  direction?: Direction;
};
type Direction = "forward" | "back";

function AppLink({
  href,
  locale,
  newTab = false,
  download,
  prefetch,
  scroll,
  replace,
  className,
  rel,
  children,
  direction,
  onMouseEnter,
  onTouchStart,
  onClick,
  ...props
}: LinkProps) {
  const external = /^(https?:)?\/\//i.test(href);
  const native = external || href.startsWith("#") || download !== undefined;
  const attributes = {
    ...props,
    ...(onMouseEnter === undefined ? {} : { onMouseEnter }),
    ...(onTouchStart === undefined ? {} : { onTouchStart }),
    ...(onClick === undefined ? {} : { onClick }),
    className: cn(styles.link, className),
    "data-external": external || undefined,
    target: newTab ? "_blank" : undefined,
    rel: newTab
      ? [...new Set([...(rel?.split(/\s+/) ?? []), "noopener", "noreferrer"])].join(" ")
      : rel,
  };
  const navigation = {
    ...(prefetch === undefined ? {} : { prefetch }),
    ...(scroll === undefined ? {} : { scroll }),
    ...(replace === undefined ? {} : { replace }),
  };
  const contents = (
    <>
      {!external && download === undefined && direction === "back" && (
        <ArrowLeft className={styles.indicator} aria-hidden="true" />
      )}
      {children}
      {download !== undefined ? (
        <Download className={styles.indicator} aria-hidden="true" />
      ) : external ? (
        <ArrowUpRight className={styles.indicator} aria-hidden="true" />
      ) : direction === "forward" ? (
        <ArrowRight className={styles.indicator} aria-hidden="true" />
      ) : null}
    </>
  );
  const link = native ? (
    <a {...attributes} href={href} download={download}>
      {contents}
    </a>
  ) : locale ? (
    // Explicit locales also work in the global 404 shell without a routing provider.
    <NextLink {...attributes} href={getPathname({ locale, href })} {...navigation}>
      {contents}
    </NextLink>
  ) : (
    <LocalizedLink {...attributes} href={href} {...navigation}>
      {contents}
    </LocalizedLink>
  );
  return external || newTab || download !== undefined ? (
    <AnnouncedLink
      link={link}
      external={external}
      newTab={newTab}
      download={download !== undefined}
    />
  ) : (
    link
  );
}

function AnnouncedLink({
  link,
  external,
  newTab,
  download,
}: {
  link: ReactElement<ComponentProps<"a">>;
  external: boolean;
  newTab: boolean;
  download: boolean;
}) {
  // Nested feature providers replace messages but inherit the UI locale. Keep these
  // shared notices available even inside a provider with only feature messages.
  const locale = useLocale();
  const messages = locale === "ru" ? ru : en;
  const notice = messages[download ? "downloadsFile" : newTab ? "opensNewTab" : "externalSite"];
  // Preserve an explicit accessible name (e.g. an icon link) while adding the behavior.
  const label = link.props["aria-label"];
  const description =
    external && newTab && !download ? `${messages.externalSite}, ${notice}` : notice;
  return cloneElement(
    link,
    {
      title: link.props.title ? `${link.props.title} (${description})` : description,
      "aria-label": label ? `${label} (${description})` : undefined,
    },
    <>
      {link.props.children}
      <span className="sr-only">{` (${description})`}</span>
    </>,
  );
}

export function TextLink({
  layout = "inline",
  className,
  children,
  ...props
}: LinkProps & {
  layout?: "inline" | "standalone" | "data";
}) {
  return (
    <AppLink {...props} className={cn(styles.text, className)} data-layout={layout}>
      {layout === "data" ? children : <span data-link-label>{children}</span>}
    </AppLink>
  );
}

export function ButtonLink({
  variant = "default",
  size = "default",
  className,
  ...props
}: LinkProps & {
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
}) {
  return (
    <AppLink
      {...props}
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), styles.button, className)}
    />
  );
}

export function NavLink({ className, ...props }: LinkProps) {
  const pathname = usePathname();
  return (
    <AppLink
      {...props}
      aria-current={pathname && isCurrentPage(pathname, props.href) ? "page" : undefined}
      className={cn(styles.nav, className)}
    />
  );
}

export function LinkSurface({
  className,
  kind = "card",
  ...props
}: LinkProps & { kind?: "card" | "row" | "chart" }) {
  return <AppLink {...props} className={cn(styles.surface, className)} data-surface={kind} />;
}

export function IconLink({ className, ...props }: LinkProps & { "aria-label": string }) {
  return (
    <AppLink
      {...props}
      data-slot="button"
      className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), styles.icon, className)}
    />
  );
}

export function BrandLink({ className, ...props }: LinkProps & { "aria-label": string }) {
  return <AppLink {...props} className={cn("brand", className)} />;
}

export function SkipLink({ children }: { children: ReactNode }) {
  return (
    <AppLink href="#main" className={styles.skip}>
      {children}
    </AppLink>
  );
}

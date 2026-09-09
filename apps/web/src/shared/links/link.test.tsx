import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { Locale } from "@/i18n/routing";
import { Link2 } from "lucide-react";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { BrandLink, ButtonLink, IconLink, LinkSurface, NavLink, SkipLink, TextLink } from "./link";

vi.mock("@/i18n/navigation", async (original) => ({
  ...(await original<typeof import("@/i18n/navigation")>()),
  usePathname: () => "/methodology",
}));

function render(element: ReactElement, locale: Locale = "en") {
  // Feature providers often contain only their own messages. Shared notices must
  // still use the inherited UI locale without requiring a Navigation namespace.
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("shared links", () => {
  it.each(["en", "ru"] as const)(
    "preserves locale, query and fragment for internal links (%s)",
    (locale) => {
      const html = render(
        createElement(
          TextLink,
          { href: "/languages/ja?view=compare#scores", direction: "forward" },
          "Compare",
        ),
        locale,
      );
      expect(html).toContain(`href="/${locale}/languages/ja?view=compare#scores"`);
      expect(html).toContain("lucide-arrow-right");
      expect(html).not.toContain("lucide-arrow-up-right");
      expect(html).not.toContain('target="_blank"');
    },
  );

  it("supports explicit locale recovery without any provider", () => {
    const html = renderToStaticMarkup(
      createElement(ButtonLink, { href: "/?from=missing#main", locale: "ru" }, "Home"),
    );
    expect(html).toMatch(/href="\/ru\/?\?from=missing#main"/);
    expect(html).toContain('data-slot="button"');
    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html).not.toContain("<button");
  });

  it.each(["https://example.org/docs", "//example.org/docs"])(
    "marks external destinations without forcing a new tab (%s)",
    (href) => {
      const html = render(createElement(TextLink, { href, direction: "forward" }, "Documentation"));
      expect(html).toContain(`href="${href}"`);
      expect(html).toContain("lucide-arrow-up-right");
      expect(html).not.toContain('class="lucide lucide-arrow-right ');
      expect(html).not.toContain('target="_blank"');
      expect(html).toContain("External website");
    },
  );

  it("announces an explicit new tab and preserves extra relationships", () => {
    const html = render(
      createElement(
        ButtonLink,
        { href: "https://example.org", newTab: true, rel: "sponsored", "aria-label": "Support" },
        "Support",
      ),
      "ru",
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="sponsored noopener noreferrer"');
    expect(html).toContain('aria-label="Support (Внешний сайт, Откроется в новой вкладке)"');
    expect(html.match(/lucide-arrow-up-right/g)).toHaveLength(1);
  });

  it("keeps new-tab behavior independent of external status", () => {
    const html = render(createElement(TextLink, { href: "/releases", newTab: true }, "Releases"));
    expect(html).toContain('href="/en/releases"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Opens in a new tab");
    expect(html).not.toContain("lucide-arrow-up-right");
  });

  it("preserves data downloads and filenames without an external indicator", () => {
    const href = "data:application/x-bibtex;charset=utf-8,%40misc%7Bfixture%7D";
    const html = render(
      createElement(ButtonLink, { href, download: "fixture.bib", variant: "outline" }, "BibTeX"),
      "ru",
    );
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain('download="fixture.bib"');
    expect(html).toContain("lucide-download");
    expect(html).toContain("Скачивание файла");
    expect(html).not.toContain("lucide-arrow-up-right");
  });

  it("does not silently turn a remote file reference into a download", () => {
    const html = render(
      createElement(TextLink, { href: "https://example.org/manifest.json" }, "manifest.json"),
    );
    expect(html).not.toContain("download=");
    expect(html).not.toContain("lucide-download");
  });

  it("keeps a tooltip trigger as one named navigation anchor", () => {
    const html = render(
      createElement(
        Tooltip,
        {},
        createElement(
          TooltipTrigger,
          {
            render: createElement(IconLink, {
              href: "/languages/sw",
              "aria-label": "Compare in Swahili",
            }),
          },
          createElement(Link2, { "aria-hidden": true }),
        ),
      ),
    );
    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html).toContain('href="/en/languages/sw"');
    expect(html).toContain('aria-label="Compare in Swahili"');
    expect(html).not.toContain("<button");
  });

  it("marks the current navigation destination in the footer as well as the header", () => {
    const html = render(
      createElement(NavLink, { href: "/methodology", locale: "ru" }, "Methodology"),
      "ru",
    );
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="/ru/methodology"');
  });

  it("retains named chart anchors and brand destinations", () => {
    const chart = render(
      createElement(LinkSurface, {
        href: "/models/fixture/example?language=fi",
        kind: "chart",
        "aria-label": "Example: 80%",
        style: { height: "80%" },
      }),
    );
    expect(chart).toContain('aria-label="Example: 80%"');
    expect(chart).toContain('href="/en/models/fixture/example?language=fi"');
    expect(chart).toContain('style="height:80%"');
    const brand = renderToStaticMarkup(
      createElement(BrandLink, { href: "/", locale: "en", "aria-label": "Home" }),
    );
    expect(brand).toMatch(/href="\/en\/?"/);
  });

  it("keeps the skip link as a native, unlocalized fragment", () => {
    const html = renderToStaticMarkup(createElement(SkipLink, null, "Skip to content"));
    expect(html).toContain('href="#main"');
    expect(html).not.toContain("/en");
  });
});

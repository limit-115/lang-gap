import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NotFoundContent } from "./not-found-content";

describe("404 recovery", () => {
  it.each([
    ["en", "Compare models", "Page not found"],
    ["ru", "Сравнить модели", "Страница не найдена"],
  ] as const)("offers a server-rendered recovery button in %s", (locale, label, title) => {
    const html = renderToStaticMarkup(createElement(NotFoundContent, { locale }));

    // Recovery must work before hydration and preserve the visitor's UI language.
    const link = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "";
    expect(link).toMatch(new RegExp(`href="/${locale}/?"`));
    expect(link).toContain('data-slot="button"');
    expect(link).toContain(label);
    expect(html).toContain(`<title>${title} · Lang Gap</title>`);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });
});

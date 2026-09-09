import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { GuideModel } from "@llang-gap/contracts/guide";
import { ModelResults } from "./model-results";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat("en", options).format(value),
  }),
}));
vi.mock("@/i18n/navigation", () => ({ Link: "a", useRouter: () => ({}) }));
vi.mock("@/features/leaderboard/model-finder", () => ({ ModelFinder: () => null }));

it.each([["sw"], ["ja", "pt-BR", "fi"]])(
  "links every chart language to its results page (%j)",
  (...languages) => {
    const model: GuideModel = {
      id: "fixture/model",
      reference: { transport: "fake", model: "fixture/model" },
      profile: null,
      scores: languages.map((language) => ({
        language,
        value: 80,
        status: "ready",
        basis: "a".repeat(64),
        comparisonBasis: "a".repeat(64),
        required: 1,
        contributions: [],
      })),
    };
    const html = renderToStaticMarkup(
      createElement(ModelResults, {
        model,
        profiles: [model],
        name: "Fixture model",
        ownerId: null,
        ownerName: "Fixture",
        updatedAt: null,
        initialLanguage: null,
        isSummary: true,
        sourceHref: "/releases",
        sourceCount: 1,
        languageNames: {},
        modelOptions: [],
      }),
    );
    const rows = html.match(/<li\b[^>]*>.*?<\/li>/g)!;
    expect(rows).toHaveLength(languages.length);
    for (const language of languages) {
      const row = rows.find((entry) => entry.includes(`data-language="${language}"`));
      expect(row).toMatch(
        new RegExp(`<a[^>]*href="/languages/${language}"[^>]*><span[^>]*>${language}</span></a>`),
      );
      expect(row).toContain("80.0%");
    }
  },
);

import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSiteUrl, languageAlternates } from "./metadata";
import { serializeJsonLd } from "./json-ld";
import type { ModelReference } from "@llang-gap/contracts";
import type { GuideSnapshot } from "@llang-gap/contracts/guide";

const releaseMocks = vi.hoisted(() => ({
  releases: [] as { id: string; aggregate: ModelReference[] }[],
  guide: null as Pick<GuideSnapshot, "plan" | "languages"> | null,
}));
vi.mock("@/features/releases/data", () => ({
  getReleases: () => Promise.resolve(releaseMocks.releases),
}));
vi.mock("@/features/leaderboard/guide-data", () => ({
  getModelGuide: () => Promise.resolve(releaseMocks.guide),
}));

afterEach(() => {
  releaseMocks.releases = [];
  releaseMocks.guide = null;
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("search metadata", () => {
  it("uses the actual deployment origin and normalizes a trailing slash", () => {
    expect(resolveSiteUrl()).toBe("https://llang-gap-web.vercel.app");
    expect(resolveSiteUrl("https://example.org/")).toBe("https://example.org");
  });
  it.each([
    "http://localhost:3000",
    "https://localhost",
    "https://127.0.0.1",
    "http://example.org",
    "https://example.org/subpath",
    "https://user:secret@example.org",
    "https://example.org/?q=1",
    "https://example.org/#section",
  ])("rejects an unsuitable canonical origin %s", (value) => {
    expect(() => resolveSiteUrl(value)).toThrow("public HTTPS origin");
  });
  it("supplies reciprocal locale URLs and an explicit default", () => {
    const links = languageAlternates("/methodology");
    expect(links.en).toMatch(/\/en\/methodology\/$/);
    expect(links.ru).toMatch(/\/ru\/methodology\/$/);
    expect(links["x-default"]).toBe(links.en);
  });
  it("prevents JSON-LD text from closing its script element", () => {
    const value = { description: "</script><script>alert(1)</script>" };
    const serialized = serializeJsonLd(value);
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual(value);
  });
  it("keeps previews crawlable for noindex discovery but advertises no sitemap", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const { isPreviewDeployment } = await import("./metadata");
    const { default: robots } = await import("@/app/robots");
    const { default: sitemap } = await import("@/app/sitemap");
    expect(isPreviewDeployment).toBe(true);
    expect(robots().rules).toEqual({ userAgent: "*", allow: "/" });
    expect(robots().sitemap).toBeUndefined();
    expect(await sitemap()).toEqual([]);
  });
  it("omits unpublished release history from the production sitemap", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toHaveLength(6);
    expect(urls.filter((url) => url.endsWith("/run/"))).toEqual([
      "https://llang-gap-web.vercel.app/en/run/",
      "https://llang-gap-web.vercel.app/ru/run/",
    ]);
    expect(urls.some((url) => url.includes("localhost") || url.includes("/releases"))).toBe(false);
  });
  it("discovers both language versions only after a release is published", async () => {
    vi.stubEnv("SITE_URL", "https://llang-gap-web.vercel.app");
    releaseMocks.releases = [
      {
        id: "synthetic-fixture",
        aggregate: [
          { transport: "openrouter", model: "fixture/model" },
          { transport: "openrouter", model: "fixture/model" },
        ],
      },
    ];
    releaseMocks.guide = {
      plan: {
        schemaVersion: 2,
        aggregation: "mean-dataset-accuracy-v1",
        releases: ["synthetic-fixture"],
      },
      languages: ["sw", "fi"],
    };
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    expect(entries).toHaveLength(16);
    expect(
      entries.filter((entry) => entry.url.includes("/languages/")).map((entry) => entry.url),
    ).toEqual([
      "https://llang-gap-web.vercel.app/en/languages/sw/",
      "https://llang-gap-web.vercel.app/ru/languages/sw/",
      "https://llang-gap-web.vercel.app/en/languages/fi/",
      "https://llang-gap-web.vercel.app/ru/languages/fi/",
    ]);
    expect(
      entries
        .filter((entry) => entry.url.includes("/models/fixture/model/"))
        .map((entry) => entry.url),
    ).toEqual([
      "https://llang-gap-web.vercel.app/en/models/fixture/model/",
      "https://llang-gap-web.vercel.app/ru/models/fixture/model/",
    ]);
    expect(
      entries
        .filter((entry) => entry.url.includes("/releases/synthetic-fixture/"))
        .map((entry) => entry.url),
    ).toEqual([
      "https://llang-gap-web.vercel.app/en/releases/synthetic-fixture/",
      "https://llang-gap-web.vercel.app/ru/releases/synthetic-fixture/",
    ]);
  });
});

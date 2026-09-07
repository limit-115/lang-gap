import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSiteUrl, languageAlternates } from "./metadata";
import { serializeJsonLd } from "./json-ld";

const releaseMocks = vi.hoisted(() => ({ releases: [] as { id: string }[] }));
vi.mock("@/features/releases/data", () => ({
  getReleases: () => Promise.resolve(releaseMocks.releases),
}));

afterEach(() => {
  releaseMocks.releases = [];
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
    expect(urls).toHaveLength(4);
    expect(urls.some((url) => url.includes("localhost") || url.includes("/releases"))).toBe(false);
  });
  it("discovers both language versions only after a release is published", async () => {
    vi.stubEnv("SITE_URL", "https://llang-gap-web.vercel.app");
    releaseMocks.releases = [{ id: "synthetic-fixture" }];
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    expect(entries).toHaveLength(8);
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

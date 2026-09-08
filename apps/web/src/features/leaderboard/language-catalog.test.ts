import { describe, expect, it } from "vitest";
import { getLanguageOptions, getLanguageHref, matchesLanguage } from "./language-catalog";

describe("language shortcuts", () => {
  it("offers only supplied benchmark languages, deduplicated and sorted by name", () => {
    expect(getLanguageOptions(["ja", "es", "ja", "sw"], "en").map((item) => item.label)).toEqual([
      "Japanese",
      "Spanish",
      "Swahili",
    ]);
    expect(getLanguageOptions(["sw"], "en").map((item) => item.value)).toEqual(["sw"]);
    expect(getLanguageOptions([], "en")).toEqual([]);
  });
  it("searches localized and English names and language tags", () => {
    const option = getLanguageOptions(["ja"], "ru")[0]!;
    for (const query of ["японский", "JAPANESE", "  ja  ", "Japanese ja", ""]) {
      expect(matchesLanguage(option, query)).toBe(true);
    }
    expect(matchesLanguage(option, "Spanish")).toBe(false);
  });
  it("preserves regional tags in the language destination", () => {
    const option = getLanguageOptions(["pt-BR"], "en")[0]!;
    expect(getLanguageHref(option)).toBe("/languages/pt-BR");
    expect(matchesLanguage(option, "Brazilian")).toBe(true);
  });
});

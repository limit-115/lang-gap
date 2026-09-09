import { expect, it } from "vitest";
import { languageLabel } from "./language-label";

it("capitalizes localized language names without title-casing regional qualifiers", () => {
  expect(languageLabel("ru", "ru")).toBe("Русский");
  expect(languageLabel("ja", "ru")).toBe("Японский");
  expect(languageLabel("pt-BR", "ru")).toBe("Бразильский португальский");
  expect(languageLabel("ja", "en")).toBe("Japanese");
});

it("preserves unknown and invalid tags as fallbacks", () => {
  expect(languageLabel("xyz", "ru")).toBe("xyz");
  expect(languageLabel("invalid_tag", "ru")).toBe("invalid_tag");
});

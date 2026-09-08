import { parse } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";
import en from "./en";
import ru from "./ru";

function messageEntries(messages: Record<string, unknown>, prefix = ""): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string"
      ? [[path, value] as [string, string]]
      : messageEntries(value as Record<string, unknown>, path);
  });
}

describe.each([
  ["en", en],
  ["ru", ru],
] as const)("run builder %s messages", (_locale, messages) => {
  it("renders every help message and control label as valid ICU, including CLI placeholders", () => {
    for (const [key, message] of messageEntries(messages)) {
      expect(() => parse(message), key).not.toThrow();
    }
  });
});

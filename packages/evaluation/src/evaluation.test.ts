import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  buildPrompt,
  parseAnswer,
  protocol,
  scoreAnswer,
  toPromptQuestion,
  aggregateResults,
} from "./index";
import { questions, item } from "@tests/fixtures";

describe("five-shot prompt", () => {
  for (const language of ["en", "ru"] as const) {
    it(`matches the pinned Python reference fixture byte for byte (${language})`, async () => {
      const target = questions.find((q) => q.language === language && q.split === "test");
      if (!target) throw new Error("Missing fixture");
      const prompt = buildPrompt(
        toPromptQuestion(target),
        questions.filter((q) => q.split === "validation"),
      );
      const expected = await readFile(
        new URL(`../fixtures/${language}-5shot.txt`, import.meta.url),
        "utf8",
      );
      expect(prompt).toBe(expected);
      expect(prompt).not.toContain("PRIVATE_TEST_SOLUTION");
      expect(
        buildPrompt(
          toPromptQuestion({ ...target, answer: "D", cot: "LEAK" }),
          questions.filter((q) => q.split === "validation"),
        ),
      ).toBe(prompt);
      expect(Object.keys(toPromptQuestion(target))).not.toEqual(
        expect.arrayContaining(["answer", "cot"]),
      );
    });
    it(`keeps all subject descriptions in sync with the pinned YAML (${language})`, async () => {
      for (const [category, description] of Object.entries(
        protocol.reference[language].descriptions,
      )) {
        const text = await readFile(
          new URL(
            `../reference/${language}/mmlu_prox_lite_${language}_${category}.yaml`,
            import.meta.url,
          ),
          "utf8",
        );
        const data = parse(text, {
          customTags: [{ tag: "!function", resolve: (value: string) => value }],
        }) as { description: string };
        expect(description).toBe(data.description);
      }
    });
  }
  it("rejects test questions disguised as demonstrations", () => {
    const q = questions.find((q) => q.split === "test")!;
    const examples = questions.filter((q) => q.language === "en" && q.split === "validation");
    expect(() => buildPrompt(toPromptQuestion(q), [...examples.slice(0, 4), q])).toThrow(
      "validation",
    );
  });
});

describe("terminal answer parser", () => {
  it.each([
    ["Reasoning. The answer is (B).", "en", "B"],
    ["**The answer is (C)**", "en", "C"],
    ["Ответ — (D).", "ru", "D"],
    ["ответ - b", "ru", "B"],
    ["The answer is (A). On reflection, the answer is (C).", "en", "C"],
    ["The answer is (A) or (B)", "en", null],
    ["B", "en", null],
    ["The answer is (J)", "en", null],
    ["The answer is (B)", "ru", null],
    ["The answer is (A). I am unsure.", "en", null],
  ] as const)("%s / %s", (text, language, expected) => {
    expect(parseAnswer(text, language, 4)).toBe(expected);
  });
  it("scores refusals and truncations zero even when they contain a correct marker", () => {
    expect(scoreAnswer("The answer is (B)", "en", "B", 4, "refusal").correct).toBe(false);
    expect(scoreAnswer("The answer is (B)", "en", "B", 4, "truncated").correct).toBe(false);
  });
});

describe("paired cluster bootstrap", () => {
  const base = [
    item({ questionId: "q1", language: "en", correct: true }),
    item({ questionId: "q1", language: "ru", correct: false }),
    item({ questionId: "q2", language: "en", correct: true }),
    item({ questionId: "q2", language: "ru", correct: true }),
  ];
  it("uses signed percentage points and a known paired interval", () => {
    const [score] = aggregateResults(base, 42, 1000);
    expect(score).toMatchObject({ en: 1, ru: 0.5, gapPp: 50, gapCi95: [0, 100], n: 2, repeats: 1 });
  });
  it("preserves question clusters across repeats", () => {
    const repeated = [0, 1, 2].flatMap((repeat) => base.map((row) => ({ ...row, repeat })));
    const [a] = aggregateResults(base, 42, 1000);
    const [b] = aggregateResults(repeated, 42, 1000);
    expect(b?.gapCi95).toEqual(a?.gapCi95);
    expect(b?.n).toBe(2);
    expect(b?.repeats).toBe(3);
    expect(aggregateResults([...repeated].reverse(), 42, 1000)).toEqual(
      aggregateResults(repeated, 42, 1000),
    );
  });
  it("rejects incomplete and duplicate language/repeat sets", () => {
    expect(() => aggregateResults(base.slice(1), 42)).toThrow("Incomplete");
    expect(() => aggregateResults([...base, base[0]!], 42)).toThrow("duplicated");
  });
});

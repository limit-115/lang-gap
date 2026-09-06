import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  buildPrompt,
  formatQuestion,
  getProtocol,
  parseAnswer,
  protocol,
  protocolV2,
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
      expect(
        buildPrompt(
          toPromptQuestion(target),
          questions.filter((q) => q.split === "validation"),
          protocol.id,
        ),
      ).toBe(expected);
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

describe("explicit target-only five-shot prompt", () => {
  const localizedStructure = {
    en: {
      examplesStart: "[BEGIN SOLVED EXAMPLES]",
      examplesEnd: "[END SOLVED EXAMPLES]",
      targetStart: "[BEGIN TARGET QUESTION]",
      targetEnd: "[END TARGET QUESTION]",
      requirements: [
        "five solved examples as reference material",
        "one target question",
        "Solve ONLY the question in the target question block.",
        "Do not solve or repeat the solved examples",
        "do not repeat the target question",
        "Give brief reasoning only if needed.",
        'exactly "The answer is (X)."',
        "Write nothing after this terminal answer.",
      ],
    },
    ru: {
      examplesStart: "[НАЧАЛО РЕШЁННЫХ ПРИМЕРОВ]",
      examplesEnd: "[КОНЕЦ РЕШЁННЫХ ПРИМЕРОВ]",
      targetStart: "[НАЧАЛО ЦЕЛЕВОГО ВОПРОСА]",
      targetEnd: "[КОНЕЦ ЦЕЛЕВОГО ВОПРОСА]",
      requirements: [
        "пять решённых примеров в качестве справочного материала",
        "один целевой вопрос",
        "Решите ТОЛЬКО вопрос в блоке целевого вопроса.",
        "Не решайте и не повторяйте решённые примеры",
        "не повторяйте целевой вопрос",
        "Приведите краткое рассуждение, только если это необходимо.",
        'строго фразой "Ответ - (X)."',
        "После этой заключительной фразы ничего не пишите.",
      ],
    },
  };

  for (const language of ["en", "ru"] as const) {
    it(`preserves the five solved examples inside a separate reference block (${language})`, async () => {
      const target = questions.find((q) => q.language === language && q.split === "test")!;
      const validation = questions.filter((q) => q.split === "validation");
      const prompt = buildPrompt(toPromptQuestion(target), validation, protocolV2.id);
      const [expected, v1Golden] = await Promise.all([
        readFile(new URL(`../fixtures/${language}-5shot-v2.txt`, import.meta.url), "utf8"),
        readFile(new URL(`../fixtures/${language}-5shot.txt`, import.meta.url), "utf8"),
      ]);
      expect(prompt).toBe(expected);
      const structure = localizedStructure[language];
      for (const delimiter of [
        structure.examplesStart,
        structure.examplesEnd,
        structure.targetStart,
        structure.targetEnd,
      ]) {
        expect(prompt.split(delimiter)).toHaveLength(2);
      }
      const examplesStart =
        prompt.indexOf(structure.examplesStart) + structure.examplesStart.length;
      const examplesEnd = prompt.indexOf(structure.examplesEnd);
      const targetStart = prompt.indexOf(structure.targetStart) + structure.targetStart.length;
      const targetEnd = prompt.indexOf(structure.targetEnd);
      expect(examplesStart).toBeLessThan(examplesEnd);
      expect(examplesEnd).toBeLessThan(targetStart);
      expect(targetStart).toBeLessThan(targetEnd);
      const targetText = formatQuestion(toPromptQuestion(target));
      const v1Examples = v1Golden.slice(
        protocol.reference[language].descriptions.math.length,
        -(targetText.length + protocol.reference[language].labels[2]!.length),
      );
      expect(prompt.slice(examplesStart, examplesEnd)).toBe(`\n${v1Examples}`);
      expect(prompt.slice(targetStart, targetEnd)).toBe(`\n${targetText}`);
      for (const requirement of structure.requirements) expect(prompt).toContain(requirement);
      expect(prompt.slice(targetEnd + structure.targetEnd.length)).not.toContain(
        protocol.reference[language].labels[2],
      );
    });

    it(`includes one target without its gold answer or solution (${language})`, () => {
      const base = questions.find((q) => q.language === language && q.split === "test")!;
      const target = {
        ...base,
        question: "UNIQUE_TARGET_QUESTION",
        options: ["TARGET_OPTION_A", "TARGET_OPTION_B", "TARGET_OPTION_C", "TARGET_OPTION_D"],
        answer: "D",
        cot: "PRIVATE_TARGET_SOLUTION",
      };
      const validation = questions.filter((q) => q.split === "validation");
      const prompt = buildPrompt(toPromptQuestion(target), validation, protocolV2.id);
      expect(prompt.split(target.question)).toHaveLength(2);
      for (const [i, option] of target.options.entries()) {
        expect(prompt.split(`${String.fromCharCode(65 + i)}. ${option}\n`)).toHaveLength(2);
      }
      expect(prompt).not.toContain(target.cot);
      expect(prompt).not.toContain("PRIVATE_TEST_SOLUTION");
      expect(prompt).not.toContain(language === "en" ? "The answer is (D)." : "Ответ - (D).");
      const changedTarget = { ...target, answer: "A", cot: "CHANGED_PRIVATE_SOLUTION" };
      expect(buildPrompt(changedTarget, validation, protocolV2.id)).toBe(prompt);
    });
  }

  it("preserves the v1 protocol hash and gives v2 a distinct pinned protocol hash", () => {
    const protocolHash = (value: unknown) =>
      createHash("sha256")
        .update(`${JSON.stringify(value, null, 2)}\n`)
        .digest("hex");
    expect(protocolHash(protocol)).toBe(
      "266ad9bd948de36b5933d17cdcd131fa830a4622a40ab557cebc8e73045f4f74",
    );
    expect(protocolHash(protocolV2)).toBe(
      "c0ff40f21a913c5822aeb71d1b7341e1f6512e772b7eeb12de1a7610bd36602d",
    );
    expect(protocolHash(protocolV2)).not.toBe(protocolHash(protocol));
    expect(protocolV2.reference).toBe(protocol.reference);
    expect(protocolV2.parserVersion).toBe(protocol.parserVersion);
    expect(protocolV2.bootstrapSamples).toBe(protocol.bootstrapSamples);
    expect(getProtocol(protocol.id)).toBe(protocol);
    expect(getProtocol(protocolV2.id)).toBe(protocolV2);
  });

  it.each(["", "unknown", "mmluprox-lite-5shot-native-reasoning-v3", "toString"])(
    "rejects an unknown protocol ID: %s",
    (id) => {
      expect(() => getProtocol(id)).toThrow(`Unsupported protocol: ${id}`);
      expect(() => buildPrompt(toPromptQuestion(questions[0]!), [], id)).toThrow(
        `Unsupported protocol: ${id}`,
      );
    },
  );

  it("applies the same validation-example safeguards to v2", () => {
    const target = questions.find((q) => q.language === "en" && q.split === "test")!;
    const validation = questions.filter((q) => q.language === "en" && q.split === "validation");
    expect(() =>
      buildPrompt(toPromptQuestion(target), validation.slice(0, 4), protocolV2.id),
    ).toThrow("Five distinct validation examples required");
    expect(() =>
      buildPrompt(toPromptQuestion(target), [...validation.slice(0, 4), target], protocolV2.id),
    ).toThrow("Five distinct validation examples required");
    expect(() =>
      buildPrompt(
        toPromptQuestion(target),
        [...validation.slice(0, 4), validation[0]!],
        protocolV2.id,
      ),
    ).toThrow("Duplicate few-shot example");
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

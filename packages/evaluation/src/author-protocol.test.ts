import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { questions } from "@tests/fixtures";
import {
  buildPrompt,
  getProtocol,
  parseAnswer,
  protocol,
  protocolV1,
  scoreAnswer,
  textBeforeStop,
  toPromptQuestion,
} from "./index";
const parity = JSON.parse(
  await readFile(new URL("../fixtures/harness-parity.json", import.meta.url), "utf8"),
) as {
  referenceCommit: string;
  prompts: Record<"en" | "ru", Record<string, string>>;
  extraction: Record<
    "en" | "ru",
    {
      text: string;
      answer: string | null;
      stoppedText: string;
      stoppedAnswer: string | null;
    }[]
  >;
};

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

describe("pinned author protocol", () => {
  it("preserves the historical v1 object and prompt bytes", () => {
    expect(parity.referenceCommit).toBe(protocol.referenceCommit);
    expect(sha256(`${JSON.stringify(protocolV1, null, 2)}\n`)).toBe(
      "266ad9bd948de36b5933d17cdcd131fa830a4622a40ab557cebc8e73045f4f74",
    );
    expect(sha256(`${JSON.stringify(protocol, null, 2)}\n`)).toBe(
      "fb5bcd17fbff709d3a50010fc2dac0cd06922318a1880e99aaa67e54ad1397ed",
    );
    expect(getProtocol(protocolV1.id)).toBe(protocolV1);
    for (const target of questions.filter((q) => q.split === "test")) {
      const validation = questions.filter((q) => q.split === "validation");
      expect(buildPrompt(toPromptQuestion(target), validation, protocol.id)).toBe(
        buildPrompt(toPromptQuestion(target), validation, protocolV1.id),
      );
    }
  });

  for (const language of ["en", "ru"] as const) {
    it(`matches all subject prompts assembled by the Python harness (${language})`, () => {
      for (const [category, expected] of Object.entries(parity.prompts[language])) {
        const pool = questions.map((q) => ({ ...q, category: category.replaceAll("_", " ") }));
        const target = pool.find((q) => q.language === language && q.split === "test")!;
        const prompt = buildPrompt(toPromptQuestion(target), pool, protocol.id);
        expect(sha256(prompt)).toBe(expected);
        expect(prompt).not.toContain("PRIVATE_TEST_SOLUTION");
      }
    });

    it(`selects first five in source order without test rows or sorting (${language})`, () => {
      const pool = questions.filter((q) => q.split === "validation" && q.language === language);
      const target = questions.find((q) => q.split === "test" && q.language === language)!;
      const ordered = [pool[3]!, pool[0]!, pool[4]!, pool[1]!, pool[2]!];
      const extra = { ...pool[0]!, id: "sixth", question: "SIXTH_MUST_NOT_APPEAR" };
      const prompt = buildPrompt(
        toPromptQuestion(target),
        [target, ...ordered, extra],
        protocol.id,
      );
      expect(prompt).toBe(buildPrompt(toPromptQuestion(target), ordered, protocol.id));
      expect(prompt).not.toContain(extra.question);
      expect(ordered.map((q) => prompt.indexOf(q.question))).toEqual(
        ordered.map((q) => prompt.indexOf(q.question)).sort((a, b) => a - b),
      );
      expect(() => buildPrompt(toPromptQuestion(target), ordered.slice(1), protocol.id)).toThrow(
        "Five",
      );
    });

    it(`pins extraction and generation to the actual Lite YAML (${language})`, async () => {
      const text = await readFile(
        new URL(`../reference/${language}/_${language}_lite_template_yaml`, import.meta.url),
        "utf8",
      );
      const yaml = parse(text, {
        customTags: [{ tag: "!function", resolve: (v: string) => v }],
      }) as {
        filter_list: { filter: { regex_pattern: string }[] }[];
        generation_kwargs: {
          until: string[];
          do_sample: boolean;
          temperature: number;
          max_gen_toks: number;
        };
        fewshot_config: { sampler: string };
        num_fewshot: number;
      };
      expect(protocol.extraction[language]).toBe(yaml.filter_list[0]!.filter[0]!.regex_pattern);
      expect(protocol.generation.until[language]).toEqual(yaml.generation_kwargs.until);
      expect(protocol.generation.maxGenTokens).toBe(yaml.generation_kwargs.max_gen_toks);
      expect(protocol.generation.temperature).toBe(yaml.generation_kwargs.temperature);
      expect(protocol.generation.doSample).toBe(yaml.generation_kwargs.do_sample);
      expect(protocol.fewshot.sampler).toBe(yaml.fewshot_config.sampler);
      expect(protocol.fewshot.count).toBe(yaml.num_fewshot);
    });

    it(`matches Python RegexFilter → take_first and stop processing (${language})`, () => {
      for (const test of parity.extraction[language]) {
        expect(parseAnswer(test.text, language, 2, protocol.id), test.text).toBe(test.answer);
        expect(textBeforeStop(test.text, language, protocol.id), test.text).toBe(test.stoppedText);
        expect(
          scoreAnswer(test.text, language, "B", 2, "completed", protocol.id).answer,
          test.text,
        ).toBe(test.stoppedAnswer);
      }
    });
  }

  it("keeps first-match semantics for ambiguity, out-of-range letters and cap-limited text", () => {
    expect(parseAnswer("The answer is (J). The answer is (B).", "en", 2, protocol.id)).toBe("J");
    expect(
      scoreAnswer("The answer is (B). Further explanation", "en", "B", 2, "truncated", protocol.id),
    ).toEqual({ answer: "B", correct: true });
    expect(scoreAnswer("", "en", "B", 2, "refusal", protocol.id)).toEqual({
      answer: null,
      correct: false,
    });
    expect(
      scoreAnswer(
        "The answer is (B). Further explanation",
        "en",
        "B",
        2,
        "completed",
        protocolV1.id,
      ).answer,
    ).toBeNull();
    expect(parseAnswer("ответ — b", "ru", 2, protocol.id)).toBeNull();
    expect(parseAnswer("ответ — b", "ru", 2, protocolV1.id)).toBe("B");
  });
});

it("keeps flexible-cap prompt bytes and stop/extraction behavior identical to author v3", () => {
  const flexible = "mmluprox-lite-5shot-flexible-api-v1";
  expect(getProtocol(flexible).id).toBe(flexible);
  for (const target of questions.filter((q) => q.split === "test")) {
    expect(
      buildPrompt(
        toPromptQuestion(target),
        questions.filter((q) => q.split === "validation"),
        flexible,
      ),
    ).toBe(
      buildPrompt(
        toPromptQuestion(target),
        questions.filter((q) => q.split === "validation"),
        protocol.id,
      ),
    );
  }
  for (const language of ["en", "ru"] as const) {
    for (const fixture of parity.extraction[language]) {
      expect(textBeforeStop(fixture.text, language, flexible)).toBe(fixture.stoppedText);
      expect(scoreAnswer(fixture.text, language, "B", 10, "completed", flexible)).toEqual(
        scoreAnswer(fixture.text, language, "B", 10, "completed", protocol.id),
      );
    }
  }
});

import type { PromptQuestion, Question } from "@llang-gap/contracts";
import reference from "#src/reference.json";

export function mmluproxLanguage(language: string): keyof typeof reference {
  if (!Object.hasOwn(reference, language))
    throw new Error(
      `Pinned MMLU-ProX protocol does not support ${language}; select a protocol with reviewed language inputs`,
    );
  return language as keyof typeof reference;
}

export function mmluproxAnswerFormat(language: string) {
  const formats = {
    en: { prefix: "Synthetic test response. The answer is (", suffix: ")" },
    ru: { prefix: "Синтетический тестовый ответ. Ответ - (", suffix: ")" },
  };
  return formats[mmluproxLanguage(language)];
}

export function formatQuestion(q: PromptQuestion): string {
  const words = reference[mmluproxLanguage(q.language)].labels;
  return `${words[0]}\n${q.question}\n${words[1]}\n${q.options.map((option, i) => `${String.fromCharCode(65 + i)}. ${option}\n`).join("")}`;
}

export function buildMmluproxPrompt(
  target: PromptQuestion,
  validation: readonly Question[],
  selectExamples: (pool: readonly Question[]) => readonly Question[],
): string {
  const language = mmluproxLanguage(target.language);
  const spec = reference[language];
  const category = target.category.replaceAll(" ", "_");
  if (!(category in spec.descriptions)) throw new Error(`Unsupported subject: ${category}`);
  const pool = validation.filter((q) => q.category === target.category && q.language === language);
  const examples = selectExamples(pool);
  if (examples.length !== 5 || examples.some((q) => q.split !== "validation" || q.id === target.id))
    throw new Error("Five distinct validation examples required");
  if (new Set(examples.map((q) => q.id)).size !== 5) throw new Error("Duplicate few-shot example");
  const description = spec.descriptions[category as keyof typeof spec.descriptions];
  const cotPrefix = spec.labels[4];
  const answerPrefix = spec.labels[2];
  if (!cotPrefix || !answerPrefix) throw new Error("Invalid pinned prompt labels");
  return (
    description +
    examples
      .map((q) => formatQuestion(q) + q.cot.replaceAll(cotPrefix, answerPrefix) + "\n\n")
      .join("") +
    formatQuestion(target) +
    answerPrefix
  );
}

export function validateMmluproxDataset(dataset: string, languages: readonly string[]) {
  if (dataset !== "mmlu-prox-lite")
    throw new Error("Pinned MMLU-ProX protocol requires its recorded dataset");
  for (const language of languages) mmluproxLanguage(language);
}

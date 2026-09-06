import type { Language, PromptQuestion, Question } from "@llang-gap/contracts";
import reference from "./reference.json";

export const protocol = {
  id: "mmluprox-lite-5shot-native-reasoning-v1",
  version: 1,
  referenceCommit: "b954108c9baaaa934b4ad842033b31a97ee30816",
  parserVersion: "terminal-answer-v1",
  bootstrapSamples: 10_000,
  reference,
  adaptations: [
    "Single user message; no system prompt, tools or conversation history.",
    "Native effort; no temperature, sampling or stop-sequence override.",
    "Output token cap from the resolved experiment includes native reasoning.",
    "Parse the terminal answer marker, accepting case and Unicode dash variants; no bare-letter fallback.",
  ],
} as const;

export function toPromptQuestion(q: Question): PromptQuestion {
  return {
    id: q.id,
    language: q.language,
    category: q.category,
    question: q.question,
    options: [...q.options],
  };
}
export function formatQuestion(q: PromptQuestion): string {
  const words = reference[q.language].labels;
  return `${words[0]}\n${q.question}\n${words[1]}\n${q.options.map((option, i) => `${String.fromCharCode(65 + i)}. ${option}\n`).join("")}`;
}
export function buildPrompt(target: PromptQuestion, validation: readonly Question[]): string {
  const language: Language = target.language;
  const spec = reference[language];
  const category = target.category.replaceAll(" ", "_");
  if (!(category in spec.descriptions)) throw new Error(`Unsupported subject: ${category}`);
  const examples = validation.filter(
    (q) => q.category === target.category && q.language === language,
  );
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
      .map(
        (q) =>
          formatQuestion(toPromptQuestion(q)) + q.cot.replaceAll(cotPrefix, answerPrefix) + "\n\n",
      )
      .join("") +
    formatQuestion(target) +
    answerPrefix
  );
}

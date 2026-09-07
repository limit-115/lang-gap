import type { Language, PromptQuestion, ProtocolId, Question } from "@llang-gap/contracts";
import reference from "#src/reference.json";

// Immutable: existing snapshots hash this exact object.
export const protocolV1 = {
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

export const protocol = {
  id: "mmluprox-lite-5shot-author-api-v3",
  version: 3,
  referenceCommit: protocolV1.referenceCommit,
  parserVersion: "mmluprox-regex-first-v1",
  bootstrapSamples: 10_000,
  reference,
  fewshot: { split: "validation", sampler: "first_n", count: 5, order: "source" },
  extraction: {
    en: "answer is \\(?([ABCDEFGHIJ])\\)?",
    ru: "Ответ - \\(?([ABCDEFGHIJ])\\)?",
    groupSelect: 0,
    fallback: "[invalid]",
  },
  generation: {
    doSample: false,
    temperature: 0,
    maxGenTokens: 2048,
    until: {
      en: ["</s>", "Q:", "Question:", "<|im_end|>"],
      ru: ["</s>", "Q:", "Вопрос:", "<|im_end|>"],
    },
  },
  adaptations: [
    "Single user message instead of vLLM text completion; no system prompt, tools or history.",
    "Native effort; selected APIs reject temperature=0 and do not expose greedy decoding.",
    "The 2048-token API cap includes hidden reasoning; visible-only token budgeting is unavailable.",
    "Anthropic receives native stop sequences; OpenAI Responses has no stop parameter. Both are cut at the first visible task stop before extraction; provider EOS is not exposed.",
    "Score visible text, including cap-limited outputs; provider reasoning blocks are unavailable for extraction. Represent the harness invalid sentinel as null.",
    "Missing technical outcomes and truncation block publication under the project's release policy; cap-limited text is still scored by the author regex, without exclusions or selective retries.",
    "Prespecified native-effort conditions, repeats and paired bootstrap are Llang Gap extensions.",
  ],
} as const;

// A distinct condition: reuse pinned task inputs without changing historical objects.
export const flexibleProtocol = {
  ...protocol,
  id: "mmluprox-lite-5shot-flexible-api-v1",
  version: 1,
  generation: { ...protocol.generation, maxGenTokens: null },
  adaptations: [
    ...protocol.adaptations.filter((entry) => !entry.startsWith("The 2048-token")),
    "Output cap is an explicit experiment input: a positive integer or null to omit the API parameter. Provider defaults and limits still apply; this is not the author 2048-token condition.",
  ],
} as const;

export const usesAuthorExtraction = (id: ProtocolId) =>
  id === protocol.id || id === flexibleProtocol.id;

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
  protocolId: ProtocolId,
): string {
  const language = mmluproxLanguage(target.language);
  const spec = reference[language];
  const category = target.category.replaceAll(" ", "_");
  if (!(category in spec.descriptions)) throw new Error(`Unsupported subject: ${category}`);
  const pool = validation.filter((q) => q.category === target.category && q.language === language);
  // first_n follows the subject-filtered validation split, never a sort or RNG.
  // Keep the historical v1 validation behavior for its existing snapshots.
  const examples =
    protocolId === protocolV1.id ? pool : pool.filter((q) => q.split === "validation").slice(0, 5);
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

export function parseTerminalAnswer(
  text: string,
  language: Language,
  optionCount: number,
): string | null {
  mmluproxLanguage(language);
  const normalized = text.trim().replaceAll("**", "").replaceAll("__", "");
  const pattern =
    language === "en"
      ? /(?:the\s+)?answer\s+is\s*\(?([A-J])\)?[.!\s]*$/i
      : /ответ\s*[-–—]\s*\(?([A-J])\)?[.!\s]*$/i;
  const answer = normalized.match(pattern)?.[1]?.toUpperCase() ?? null;
  return answer && answer.charCodeAt(0) - 65 < optionCount ? answer : null;
}

export function mmluproxTextBeforeStop(text: string, language: Language): string {
  let end = text.length;
  for (const stop of protocol.generation.until[mmluproxLanguage(language)]) {
    const index = text.indexOf(stop);
    if (index !== -1) end = Math.min(end, index);
  }
  return text.slice(0, end);
}

export function parseMmluproxAuthorAnswer(text: string, language: string): string | null {
  return new RegExp(protocol.extraction[mmluproxLanguage(language)]).exec(text)?.[1] ?? null;
}

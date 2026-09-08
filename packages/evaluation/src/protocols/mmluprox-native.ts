import type { ProtocolAdapter, Language } from "@llang-gap/contracts";
import reference from "#src/reference.json";
import {
  buildMmluproxPrompt,
  mmluproxLanguage,
  mmluproxAnswerFormat,
  validateMmluproxDataset,
} from "./mmluprox";

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

export const nativeAdapter = {
  definition: protocolV1,
  buildPrompt: (target, validation) => buildMmluproxPrompt(target, validation, (pool) => pool),
  validateDataset: validateMmluproxDataset,
  parseAnswer: parseTerminalAnswer,
  extractAnswer: (text, language, optionCount, outcome) =>
    outcome === "completed" ? parseTerminalAnswer(text, language, optionCount) : null,
  textBeforeStop: (text) => text,
  getStopSequences: () => undefined,
  getAnswerFormat: mmluproxAnswerFormat,
  tokenPolicy: { fixed: null, required: true },
  validateOutputTokens(cap) {
    if (cap === null)
      throw new Error(
        "Historical protocol requires a numeric cap; select mmluprox-lite-5shot-flexible-api-v1",
      );
  },
} satisfies ProtocolAdapter;

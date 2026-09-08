import type { ProtocolAdapter, Language } from "@llang-gap/contracts";
import reference from "#src/reference.json";
import {
  buildMmluproxPrompt,
  mmluproxLanguage,
  mmluproxAnswerFormat,
  validateMmluproxDataset,
} from "./mmluprox";
import { protocolV1 } from "./mmluprox-native";

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

export const authorAdapter = {
  definition: protocol,
  // first_n follows the subject-filtered validation split, never a sort or RNG.
  buildPrompt: (target, validation) =>
    buildMmluproxPrompt(target, validation, (pool) =>
      pool.filter((q) => q.split === "validation").slice(0, 5),
    ),
  validateDataset: validateMmluproxDataset,
  // The author regex takes the first match and does not check the option count.
  parseAnswer: parseMmluproxAuthorAnswer,
  extractAnswer: (text, language) =>
    parseMmluproxAuthorAnswer(mmluproxTextBeforeStop(text, language), language),
  textBeforeStop: mmluproxTextBeforeStop,
  getStopSequences: (language) => protocol.generation.until[mmluproxLanguage(language)],
  getAnswerFormat: mmluproxAnswerFormat,
  tokenPolicy: { fixed: protocol.generation.maxGenTokens, required: true },
  validateOutputTokens(cap) {
    if (cap !== protocol.generation.maxGenTokens)
      throw new Error(
        `Selected protocol requires a ${protocol.generation.maxGenTokens}-token cap; a different cap needs a separate protocol, such as mmluprox-lite-5shot-flexible-api-v1`,
      );
  },
} satisfies ProtocolAdapter;

import type {
  DatasetManifest,
  PromptLabels,
  PromptQuestion,
  ProtocolId,
  Question,
} from "@llang-gap/contracts";

import {
  protocol,
  protocolV1,
  flexibleProtocol,
  usesAuthorExtraction,
  mmluproxLanguage,
  buildMmluproxPrompt,
  validateMmluproxDataset,
  mmluproxAnswerFormat,
} from "#src/protocols/mmluprox";
export { protocol, protocolV1, formatQuestion } from "#src/protocols/mmluprox";

export const multipleChoiceProtocol = {
  id: "multiple-choice-v1",
  version: 1,
  parserVersion: "bare-option-letter-v1",
  bootstrapSamples: 10_000,
  fewshot: { count: 0 },
  prompt:
    "Dataset-manifest localized instruction, question label, target text, options label, A-J options. Blank line separates each section. Final newline.",
  extraction:
    "Trim surrounding whitespace; accept exactly one uppercase A-J letter within the option count. All other visible outputs score zero.",
  adaptations: [
    "One independent user message. Native effort and output cap are explicit experiment settings.",
  ],
} as const;

export function getProtocol(id: ProtocolId) {
  if (id === multipleChoiceProtocol.id) return multipleChoiceProtocol;
  if (id === protocolV1.id) return protocolV1;
  if (id === protocol.id) return protocol;
  if (id === flexibleProtocol.id) return flexibleProtocol;
  throw new Error(`Unsupported protocol: ${String(id)}`);
}

export function toPromptQuestion(q: Question): PromptQuestion {
  return {
    id: q.id,
    language: q.language,
    category: q.category,
    question: q.question,
    options: [...q.options],
  };
}
export function buildPrompt(
  target: PromptQuestion,
  validation: readonly Question[],
  protocolId: ProtocolId,
  labels?: PromptLabels,
): string {
  getProtocol(protocolId);
  if (protocolId !== multipleChoiceProtocol.id)
    return buildMmluproxPrompt(target, validation, protocolId);
  if (!labels) throw new Error(`Missing localized prompt instructions: ${target.language}`);
  return `${labels.instruction}\n\n${labels.question}\n${target.question}\n\n${labels.options}\n${target.options.map((option, i) => `${String.fromCharCode(65 + i)}. ${option}`).join("\n")}\n`;
}

export function getPromptLabels(
  manifest: DatasetManifest | undefined,
  language: string,
): PromptLabels | undefined {
  return manifest && manifest.schemaVersion !== 1 ? manifest.prompts[language] : undefined;
}
export function getStopSequences(id: ProtocolId, language: string): readonly string[] | undefined {
  return usesAuthorExtraction(id)
    ? protocol.generation.until[mmluproxLanguage(language)]
    : undefined;
}
export function validateProtocolDataset(
  id: ProtocolId,
  dataset: string,
  languages: readonly string[],
  manifest?: DatasetManifest,
) {
  getProtocol(id);
  if (manifest && manifest.id !== dataset)
    throw new Error("Experiment / dataset manifest mismatch");
  if (id === multipleChoiceProtocol.id) {
    for (const language of languages)
      if (!getPromptLabels(manifest, language))
        throw new Error(`Missing localized prompt instructions: ${language}`);
  } else {
    validateMmluproxDataset(dataset, languages);
  }
}

export function getAnswerFormat(id: ProtocolId, language: string) {
  return id === multipleChoiceProtocol.id
    ? { prefix: "", suffix: "" }
    : mmluproxAnswerFormat(language);
}
export function getMaxOutputTokens(id: ProtocolId): number | undefined {
  return id === protocol.id ? protocol.generation.maxGenTokens : undefined;
}

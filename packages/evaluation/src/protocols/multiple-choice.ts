import type { ProtocolAdapter, DatasetManifest, PromptLabels } from "@llang-gap/contracts";

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

export function getPromptLabels(
  manifest: DatasetManifest | undefined,
  language: string,
): PromptLabels | undefined {
  return manifest && manifest.schemaVersion !== 1 ? manifest.prompts[language] : undefined;
}

function parseAnswer(text: string, _language: string, optionCount: number): string | null {
  const answer = text.trim();
  return /^[A-J]$/.test(answer) && answer.charCodeAt(0) - 65 < optionCount ? answer : null;
}

export const multipleChoiceAdapter = {
  definition: multipleChoiceProtocol,
  buildPrompt(target, _validation, labels) {
    if (!labels) throw new Error(`Missing localized prompt instructions: ${target.language}`);
    return `${labels.instruction}\n\n${labels.question}\n${target.question}\n\n${labels.options}\n${target.options.map((option, i) => `${String.fromCharCode(65 + i)}. ${option}`).join("\n")}\n`;
  },
  validateDataset(_dataset, languages, manifest) {
    for (const language of languages)
      if (!getPromptLabels(manifest, language))
        throw new Error(`Missing localized prompt instructions: ${language}`);
  },
  parseAnswer,
  extractAnswer: parseAnswer,
  textBeforeStop: (text) => text,
  getStopSequences: () => undefined,
  getAnswerFormat: () => ({ prefix: "", suffix: "" }),
  tokenPolicy: { fixed: null, required: false },
  validateOutputTokens: () => {},
} satisfies ProtocolAdapter;

import type { DatasetManifest, PromptLabels, PromptQuestion, ProtocolId, Question } from "./index";

// Executable behavior stays outside the serializable definition hashed in run snapshots.
export interface ProtocolAdapter {
  definition: { readonly id: ProtocolId; readonly [key: string]: unknown };
  buildPrompt(
    target: PromptQuestion,
    validation: readonly Question[],
    labels?: PromptLabels,
  ): string;
  validateDataset(dataset: string, languages: readonly string[], manifest?: DatasetManifest): void;
  parseAnswer(text: string, language: string, optionCount: number): string | null;
  extractAnswer(
    text: string,
    language: string,
    optionCount: number,
    outcome: "completed" | "refusal" | "truncated",
  ): string | null;
  textBeforeStop(text: string, language: string): string;
  getStopSequences(language: string): readonly string[] | undefined;
  getAnswerFormat(language: string): { prefix: string; suffix: string };
  tokenPolicy: { fixed: number | null; required: boolean };
  validateOutputTokens(cap: number | null): void;
}

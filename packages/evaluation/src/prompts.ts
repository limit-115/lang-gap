import type {
  DatasetManifest,
  PromptLabels,
  PromptQuestion,
  ProtocolId,
  Question,
} from "@llang-gap/contracts";
import { getProtocolAdapter } from "#src/protocols/index";
export { protocol } from "#src/protocols/mmluprox-author";
export { protocolV1 } from "#src/protocols/mmluprox-native";
export { formatQuestion } from "#src/protocols/mmluprox";
export { multipleChoiceProtocol, getPromptLabels } from "#src/protocols/multiple-choice";

export function getProtocol(id: ProtocolId) {
  return getProtocolAdapter(id).definition;
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
  return getProtocolAdapter(protocolId).buildPrompt(target, validation, labels);
}
export function getStopSequences(id: ProtocolId, language: string): readonly string[] | undefined {
  return getProtocolAdapter(id).getStopSequences(language);
}
export function validateProtocolDataset(
  id: ProtocolId,
  dataset: string,
  languages: readonly string[],
  manifest?: DatasetManifest,
) {
  const adapter = getProtocolAdapter(id);
  if (manifest && manifest.id !== dataset)
    throw new Error("Experiment / dataset manifest mismatch");
  adapter.validateDataset(dataset, languages, manifest);
}
export function getAnswerFormat(id: ProtocolId, language: string) {
  return getProtocolAdapter(id).getAnswerFormat(language);
}
export function getMaxOutputTokens(id: ProtocolId): number | undefined {
  return getProtocolAdapter(id).tokenPolicy.fixed ?? undefined;
}
export function validateOutputTokens(id: ProtocolId, cap: number | null) {
  getProtocolAdapter(id).validateOutputTokens(cap);
}

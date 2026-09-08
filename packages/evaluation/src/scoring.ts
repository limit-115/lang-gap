import type { Language, ProtocolId } from "@llang-gap/contracts";
import { getProtocolAdapter } from "#src/protocols/index";

export function parseAnswer(
  text: string,
  language: Language,
  optionCount = 10,
  protocolId: ProtocolId,
): string | null {
  return getProtocolAdapter(protocolId).parseAnswer(text, language, optionCount);
}
export function textBeforeStop(text: string, language: Language, protocolId: ProtocolId): string {
  return getProtocolAdapter(protocolId).textBeforeStop(text, language);
}
export function scoreAnswer(
  text: string,
  language: Language,
  expected: string,
  optionCount: number,
  outcome: "completed" | "refusal" | "truncated",
  protocolId: ProtocolId,
) {
  const answer = getProtocolAdapter(protocolId).extractAnswer(text, language, optionCount, outcome);
  return { answer, correct: answer !== null && answer === expected };
}

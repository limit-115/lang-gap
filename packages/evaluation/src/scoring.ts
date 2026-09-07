import {
  parseTerminalAnswer,
  parseMmluproxAuthorAnswer,
  mmluproxTextBeforeStop,
  usesAuthorExtraction,
} from "#src/protocols/mmluprox";
import type { Language, ProtocolId } from "@llang-gap/contracts";
import { getProtocol, multipleChoiceProtocol, protocolV1 } from "./prompts";

export function parseAnswer(
  text: string,
  language: Language,
  optionCount = 10,
  protocolId: ProtocolId,
): string | null {
  getProtocol(protocolId);
  if (protocolId === multipleChoiceProtocol.id) {
    const answer = text.trim();
    return /^[A-J]$/.test(answer) && answer.charCodeAt(0) - 65 < optionCount ? answer : null;
  }
  if (protocolId === protocolV1.id) return parseTerminalAnswer(text, language, optionCount);
  // RegexFilter uses re.compile without flags, findall()[0], then take_first.
  // Do not normalize case, whitespace, dashes, Markdown, or the A-J capture.
  // The upstream regex deliberately does not check the question's option count.
  return parseMmluproxAuthorAnswer(text, language);
}

export function textBeforeStop(text: string, language: Language, protocolId: ProtocolId): string {
  getProtocol(protocolId);
  return usesAuthorExtraction(protocolId) ? mmluproxTextBeforeStop(text, language) : text;
}

export function scoreAnswer(
  text: string,
  language: Language,
  expected: string,
  optionCount: number,
  outcome: "completed" | "refusal" | "truncated",
  protocolId: ProtocolId,
) {
  getProtocol(protocolId);
  const answer =
    protocolId === protocolV1.id
      ? outcome === "completed"
        ? parseTerminalAnswer(text, language, optionCount)
        : null
      : parseAnswer(
          usesAuthorExtraction(protocolId) ? textBeforeStop(text, language, protocolId) : text,
          language,
          optionCount,
          protocolId,
        );
  return { answer, correct: answer !== null && answer === expected };
}

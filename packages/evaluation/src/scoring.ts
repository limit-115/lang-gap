import type { Language, ProtocolId } from "@llang-gap/contracts";
import { getProtocol, protocol, protocolV1 } from "./prompts";

function parseTerminalAnswer(text: string, language: Language, optionCount: number): string | null {
  const normalized = text.trim().replaceAll("**", "").replaceAll("__", "");
  const pattern =
    language === "en"
      ? /(?:the\s+)?answer\s+is\s*\(?([A-J])\)?[.!\s]*$/i
      : /ответ\s*[-–—]\s*\(?([A-J])\)?[.!\s]*$/i;
  const answer = normalized.match(pattern)?.[1]?.toUpperCase() ?? null;
  return answer && answer.charCodeAt(0) - 65 < optionCount ? answer : null;
}

export function parseAnswer(
  text: string,
  language: Language,
  optionCount = 10,
  protocolId: ProtocolId = protocol.id,
): string | null {
  getProtocol(protocolId);
  if (protocolId === protocolV1.id) return parseTerminalAnswer(text, language, optionCount);
  // RegexFilter uses re.compile without flags, findall()[0], then take_first.
  // Do not normalize case, whitespace, dashes, Markdown, or the A-J capture.
  // The upstream regex deliberately does not check the question's option count.
  return new RegExp(protocol.extraction[language]).exec(text)?.[1] ?? null;
}

export function textBeforeStop(text: string, language: Language): string {
  let end = text.length;
  for (const stop of protocol.generation.until[language]) {
    const index = text.indexOf(stop);
    if (index !== -1) end = Math.min(end, index);
  }
  return text.slice(0, end);
}

export function scoreAnswer(
  text: string,
  language: Language,
  expected: string,
  optionCount: number,
  outcome: "completed" | "refusal" | "truncated",
  protocolId: ProtocolId = protocol.id,
) {
  getProtocol(protocolId);
  const answer =
    protocolId === protocolV1.id
      ? outcome === "completed"
        ? parseTerminalAnswer(text, language, optionCount)
        : null
      : parseAnswer(textBeforeStop(text, language), language, optionCount, protocolId);
  return { answer, correct: answer !== null && answer === expected };
}

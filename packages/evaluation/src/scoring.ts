import type { Language } from "@llang-gap/contracts";

export function parseAnswer(text: string, language: Language, optionCount = 10): string | null {
  const normalized = text.trim().replaceAll("**", "").replaceAll("__", "");
  const pattern =
    language === "en"
      ? /(?:the\s+)?answer\s+is\s*\(?([A-J])\)?[.!\s]*$/i
      : /ответ\s*[-–—]\s*\(?([A-J])\)?[.!\s]*$/i;
  const answer = normalized.match(pattern)?.[1]?.toUpperCase() ?? null;
  return answer && answer.charCodeAt(0) - 65 < optionCount ? answer : null;
}
export function scoreAnswer(
  text: string,
  language: Language,
  expected: string,
  optionCount: number,
  outcome: "completed" | "refusal" | "truncated",
) {
  const answer = outcome === "completed" ? parseAnswer(text, language, optionCount) : null;
  return { answer, correct: answer !== null && answer === expected };
}

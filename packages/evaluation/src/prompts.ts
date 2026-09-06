import type { Language, PromptQuestion, Question } from "@llang-gap/contracts";
import reference from "./reference.json";

export const protocol = {
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

export const protocolV2 = {
  ...protocol,
  id: "mmluprox-lite-5shot-native-reasoning-v2",
  version: 2,
  adaptations: [
    ...protocol.adaptations,
    "The same five solved source examples, in source order, inside a delimited reference block.",
    "One separately delimited target with localized target-only instructions and optional brief reasoning.",
  ],
  promptTemplate: {
    en: {
      introduction:
        "Below are five solved examples as reference material, followed by one target question.",
      examplesStart: "[BEGIN SOLVED EXAMPLES]",
      examplesEnd: "[END SOLVED EXAMPLES]",
      targetStart: "[BEGIN TARGET QUESTION]",
      targetEnd: "[END TARGET QUESTION]",
      responseInstruction:
        'Solve ONLY the question in the target question block. Do not solve or repeat the solved examples, and do not repeat the target question. Give brief reasoning only if needed. Finish your response with exactly "The answer is (X).", replacing X with the correct option letter. Write nothing after this terminal answer.',
    },
    ru: {
      introduction:
        "Ниже приведены пять решённых примеров в качестве справочного материала, а затем один целевой вопрос.",
      examplesStart: "[НАЧАЛО РЕШЁННЫХ ПРИМЕРОВ]",
      examplesEnd: "[КОНЕЦ РЕШЁННЫХ ПРИМЕРОВ]",
      targetStart: "[НАЧАЛО ЦЕЛЕВОГО ВОПРОСА]",
      targetEnd: "[КОНЕЦ ЦЕЛЕВОГО ВОПРОСА]",
      responseInstruction:
        'Решите ТОЛЬКО вопрос в блоке целевого вопроса. Не решайте и не повторяйте решённые примеры и не повторяйте целевой вопрос. Приведите краткое рассуждение, только если это необходимо. Завершите ответ строго фразой "Ответ - (X).", заменив X буквой правильного варианта. После этой заключительной фразы ничего не пишите.',
    },
  },
} as const;

export function getProtocol(id: string): typeof protocol | typeof protocolV2 {
  switch (id) {
    case protocol.id:
      return protocol;
    case protocolV2.id:
      return protocolV2;
    default:
      throw new Error(`Unsupported protocol: ${id}`);
  }
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
export function formatQuestion(q: PromptQuestion): string {
  const words = reference[q.language].labels;
  return `${words[0]}\n${q.question}\n${words[1]}\n${q.options.map((option, i) => `${String.fromCharCode(65 + i)}. ${option}\n`).join("")}`;
}
export function buildPrompt(
  target: PromptQuestion,
  validation: readonly Question[],
  protocolId: string = protocol.id,
): string {
  const selectedProtocol = getProtocol(protocolId);
  const language: Language = target.language;
  const spec = reference[language];
  const category = target.category.replaceAll(" ", "_");
  if (!(category in spec.descriptions)) throw new Error(`Unsupported subject: ${category}`);
  const examples = validation.filter(
    (q) => q.category === target.category && q.language === language,
  );
  if (examples.length !== 5 || examples.some((q) => q.split !== "validation" || q.id === target.id))
    throw new Error("Five distinct validation examples required");
  if (new Set(examples.map((q) => q.id)).size !== 5) throw new Error("Duplicate few-shot example");
  const description = spec.descriptions[category as keyof typeof spec.descriptions];
  const cotPrefix = spec.labels[4];
  const answerPrefix = spec.labels[2];
  if (!cotPrefix || !answerPrefix) throw new Error("Invalid pinned prompt labels");
  const solvedExamples = examples
    .map(
      (q) =>
        formatQuestion(toPromptQuestion(q)) + q.cot.replaceAll(cotPrefix, answerPrefix) + "\n\n",
    )
    .join("");
  if (selectedProtocol.id === protocolV2.id) {
    const template = selectedProtocol.promptTemplate[language];
    return (
      `${template.introduction}\n\n` +
      `${template.examplesStart}\n${solvedExamples}${template.examplesEnd}\n\n` +
      `${template.targetStart}\n${formatQuestion(target)}${template.targetEnd}\n\n` +
      template.responseInstruction
    );
  }
  return description + solvedExamples + formatQuestion(target) + answerPrefix;
}

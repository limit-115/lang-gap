import { questionSchema, type Language, type Question } from "@llang-gap/contracts";

export function normalizeRow(
  row: Record<string, unknown>,
  language: Language,
  split: Question["split"],
): Question {
  const options: string[] = [];
  let ended = false;
  for (let index = 0; index < 10; index++) {
    const value = row[`option_${index}`];
    if (value === null) {
      ended = true;
      continue;
    }
    if (ended || typeof value !== "string")
      throw new Error("Invalid or non-contiguous answer options");
    options.push(value);
  }
  if (
    typeof row.answer !== "string" ||
    row.answer.charCodeAt(0) - 65 !== Number(row.answer_index)
  ) {
    throw new Error("Answer letter / index mismatch");
  }
  if (typeof row.src !== "string") throw new Error("Missing question source");
  return questionSchema.parse({
    id: `${split}:${row.src}:${String(row.question_id_src)}`,
    sourceId: Number(row.question_id_src),
    language,
    split,
    category: row.category,
    question: row.question,
    options,
    answer: row.answer,
    cot: row.cot_content,
  });
}

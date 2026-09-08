import { parse } from "csv-parse/sync";
import { questionSchema, type Question } from "@llang-gap/contracts";
import { mmpisaLanguages } from "./mmpisa-languages";

const columns = [
  "qid",
  "language",
  "language_code",
  "question",
  "context",
  "options",
  "gold",
  "answer_type",
  "category",
  "difficulty",
  "rationale",
  "source",
];

function normalizeOptions(text: string): string[] {
  const values: unknown = JSON.parse(text);
  if (!Array.isArray(values)) throw new Error("mmPISA options must be an array");
  return values.map((value: unknown, index) => {
    const label = String.fromCharCode(65 + index);
    if (typeof value === "string" && value.startsWith(`${label}) `)) return value.slice(3);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const entries = Object.entries(value);
      const components: unknown = entries[0]?.[1];
      if (
        entries.length === 1 &&
        entries[0]?.[0] === label &&
        Array.isArray(components) &&
        components.length > 0 &&
        components.every((part: unknown) => typeof part === "string" && part.trim().length > 0)
      ) {
        // A composite choice remains one option, with its component order preserved.
        return JSON.stringify(components);
      }
    }
    throw new Error(
      `Invalid mmPISA option ${label}: expected an ordered label and text or string array`,
    );
  });
}

export function decodeMmpisa(text: string, translation: "human" | "machine") {
  const rows = parse<Record<string, string>>(text, {
    bom: true,
    columns: (header: string[]) => {
      if (JSON.stringify(header) !== JSON.stringify(columns))
        throw new Error("Unexpected mmPISA CSV header");
      return header;
    },
  });
  const questions: Question[] = [];
  const identities = new Set<string>();
  for (const row of rows) {
    const machine = row.language!.endsWith(" Machine");
    const name = machine ? row.language!.slice(0, -" Machine".length) : row.language!;
    const metadata = mmpisaLanguages[name];
    if (!metadata || row.language_code !== (machine ? metadata.machineCode : metadata.humanCode))
      throw new Error(`Unknown mmPISA language identity: ${row.language}/${row.language_code}`);
    const variant = machine ? "machine" : "human";
    const key = `${variant}/${metadata.language}/${row.qid}`;
    if (identities.has(key)) throw new Error(`Duplicate mmPISA question: ${key}`);
    identities.add(key);
    if (row.answer_type !== "mc")
      throw new Error(`Unsupported mmPISA answer type: ${row.answer_type}`);
    if (
      !/^q\d+$/.test(row.qid!) ||
      !row.context?.trim() ||
      !row.question?.trim() ||
      !row.source?.trim() ||
      !row.difficulty?.trim()
    )
      throw new Error(`Missing mmPISA question metadata: ${key}`);
    const question = questionSchema.parse({
      id: row.qid,
      sourceId: row.qid,
      language: metadata.language,
      split: "test",
      category: row.category,
      question: `${row.context}\n\n${row.question}`,
      options: normalizeOptions(row.options!),
      answer: row.gold,
      cot: row.rationale === "nan" ? "" : row.rationale,
    });
    if (variant === translation) questions.push(question);
  }
  return { rowCount: rows.length, questions };
}

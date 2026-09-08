import { datasetManifestSchema } from "@llang-gap/contracts";
import { createHash } from "node:crypto";

// Invented content only; preserve the upstream shape, including quoted multiline cells.
export const mmpisaRows = ["human", "machine"].flatMap((translation) =>
  [
    { name: "Kazakh", code: "kaz-KAZ", suffix: "kk" },
    { name: "Japanese", code: "jpn-JPN", suffix: "ja" },
  ].flatMap(({ name, code, suffix }) =>
    [1, 2].map((id) => ({
      qid: `q00${id}`,
      language: `${name}${translation === "machine" ? " Machine" : ""}`,
      language_code: `${code}${translation === "machine" ? ` ${suffix}` : ""}`,
      question: `Synthetic ${translation} ${name} question ${id}?`,
      context: 'Synthetic context, with a "quote".\nSecond line.',
      options: id === 1 ? '["A) one", "B) two"]' : '[{"A":["yes","no"]},{"B":["no","yes"]}]',
      gold: "B",
      answer_type: "mc",
      category: id === 1 ? "Math" : "Reading",
      difficulty: "level 2",
      rationale: id === 1 ? "PRIVATE_TARGET_SOLUTION" : "nan",
      source: "Synthetic source",
    })),
  ),
);

export function mmpisaCsv(rows = mmpisaRows) {
  const columns = Object.keys(mmpisaRows[0]!);
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return (
    [columns.join(","), ...rows.map((row) => Object.values(row).map(quote).join(","))].join(
      "\r\n",
    ) + "\r\n"
  );
}

export function mmpisaFixture(translation: "human" | "machine" = "human") {
  const manifest = datasetManifestSchema.parse({
    schemaVersion: 3,
    id: `mmpisa-fixture-${translation}`,
    repository: "fixtures/mmpisa",
    hosting: "github",
    revision: "a".repeat(40),
    normalizerVersion: 1,
    adapter: { format: "mmpisa-csv", translation },
    license: "Synthetic fixture only",
    source: "https://example.org/mmpisa",
    prompts: {
      kk: {
        instruction: "Тек дұрыс нұсқаның бас латын әрпімен жауап беріңіз.",
        question: "Сұрақ:",
        options: "Нұсқалар:",
      },
      ja: {
        instruction: "正しい選択肢の大文字のラテン文字だけで答えてください。",
        question: "質問：",
        options: "選択肢：",
      },
    },
    files: [
      {
        path: "shared/questions.csv",
        rows: mmpisaRows.length,
        sha256: createHash("sha256").update(mmpisaCsv()).digest("hex"),
        partitions: ["kk", "ja"].map((language) => ({ language, split: "test", rows: 2 })),
      },
    ],
  });
  if (manifest.schemaVersion !== 3) throw new Error("Expected schema-v3 fixture");
  return manifest;
}

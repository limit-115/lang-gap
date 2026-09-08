import { parquetReadObjects } from "hyparquet";
import { questionSchema, type DatasetManifest, type DatasetSource } from "@llang-gap/contracts";
import { normalizeRow } from "./mmluprox";
import { decodeMmpisa } from "./mmpisa";

export async function decodeSource(
  manifest: DatasetManifest,
  source: DatasetSource,
  bytes: Buffer,
) {
  const adapter =
    manifest.schemaVersion === 3
      ? manifest.adapter
      : { format: manifest.schemaVersion === 1 ? "mmluprox-parquet" : manifest.format };
  switch (adapter.format) {
    case "mmpisa-csv":
      return decodeMmpisa(bytes.toString("utf8"), adapter.translation);
    case "normalized-jsonl": {
      const questions = bytes
        .toString("utf8")
        .trimEnd()
        .split("\n")
        .map((line) => questionSchema.parse(JSON.parse(line)));
      return { rowCount: questions.length, questions };
    }
    case "mmluprox-parquet": {
      const [partition] = source.partitions;
      if (source.partitions.length !== 1 || !partition)
        throw new Error("MMLU-ProX Parquet requires one language/split per source file");
      // Decode the exact bytes whose checksum was verified, not a second filesystem read.
      const rows = await parquetReadObjects({ file: Uint8Array.from(bytes).buffer });
      return {
        rowCount: rows.length,
        questions: rows.map((row) => normalizeRow(row, partition.language, partition.split)),
      };
    }
  }
}

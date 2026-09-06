import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";
import { experimentSchema, type Experiment } from "@llang-gap/contracts";
import { validateModel } from "@llang-gap/providers";

export function parseExperiment(text: string): Experiment {
  const document = parseDocument(text, { uniqueKeys: true, strict: true });
  if (document.errors.length || document.warnings.length)
    throw new Error(
      `Invalid YAML: ${[...document.errors, ...document.warnings].map((e) => e.message).join("; ")}`,
    );
  const experiment = experimentSchema.parse(document.toJS({ maxAliasCount: 0 }));
  for (const model of experiment.models) validateModel(model);
  if (
    experiment.models.some((m) => m.provider === "fake") &&
    experiment.models.some((m) => m.provider !== "fake")
  )
    throw new Error("Synthetic and live providers cannot be mixed");
  return experiment;
}
export async function loadExperiment(path: string): Promise<Experiment> {
  return parseExperiment(await readFile(path, "utf8"));
}

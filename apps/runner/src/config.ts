import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";
import {
  experimentSchema,
  languageSchema,
  safeIdSchema,
  type Experiment,
} from "@llang-gap/contracts";
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
    experiment.models.some((m) => m.transport === "fake") &&
    experiment.models.some((m) => m.transport !== "fake")
  )
    throw new Error("Synthetic and live providers cannot be mixed");
  return experiment;
}
export async function loadExperiment(path: string): Promise<Experiment> {
  return parseExperiment(await readFile(path, "utf8"));
}

export interface ExperimentSelection {
  dataset?: string;
  language?: string;
  languages?: string[];
  compare?: string[];
  protocol?: string;
}
export function selectExperiment(experiment: Experiment, options: ExperimentSelection): Experiment {
  if (options.language && options.languages)
    throw new Error("Use --language or --languages, not both");
  const languages = options.language ? [languageSchema.parse(options.language)] : options.languages;
  const comparisons = options.compare?.map((value) => {
    const parts = value.split(":");
    if (parts.length !== 2) throw new Error("Comparison must be baseline:language");
    return { baseline: parts[0], language: parts[1] };
  });
  return experimentSchema.parse({
    ...experiment,
    ...(options.dataset ? { dataset: safeIdSchema.parse(options.dataset) } : {}),
    ...(options.protocol ? { protocol: options.protocol } : {}),
    ...(languages ? { languages, comparisons: [] } : {}),
    ...(comparisons ? { comparisons } : {}),
  });
}

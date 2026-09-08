import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { itemResultSchema, questionSchema, releaseManifestSchema } from "@llang-gap/contracts";
import { releaseEvidenceSchema } from "@llang-gap/contracts/guide";
import { validateManifestQuestions } from "@llang-gap/datasets";
import { hash, json, readJson } from "./files";
import { snapshotSchema } from "./snapshot";

// Derive compact public metadata from an already verified/staged release. This does
// not rescore historical answers with today's implementation.
export async function createReleaseEvidence(directory: string) {
  const manifest = releaseManifestSchema.parse(await readJson(join(directory, "manifest.json")));
  if (manifest.kind !== "benchmark") throw new Error("Test releases cannot supply guide evidence");
  for (const [name, expected] of Object.entries(manifest.files)) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) throw new Error("Unsafe release filename");
    if (hash(await readFile(join(directory, name))) !== expected)
      throw new Error(`Release checksum mismatch: ${name}`);
  }
  const snapshot = snapshotSchema.parse(await readJson(join(directory, "resolved.json")));
  if (
    manifest.configHash !== manifest.files["resolved.json"] ||
    snapshot.runId !== manifest.runId ||
    snapshot.experiment.dataset !== manifest.dataset ||
    snapshot.datasetManifest.revision !== manifest.datasetRevision ||
    snapshot.experiment.protocol !== manifest.protocol ||
    snapshot.experiment.questionLimit ||
    snapshot.experiment.models.some((model) => model.transport === "fake") ||
    JSON.stringify(snapshot.experiment.languages) !== JSON.stringify(manifest.languages) ||
    hash(json(snapshot.protocol)) !== snapshot.protocolHash
  )
    throw new Error("Invalid benchmark evidence provenance");
  const questions = (await readFile(join(directory, "dataset.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => questionSchema.parse(JSON.parse(line)));
  validateManifestQuestions(questions, snapshot.datasetManifest, snapshot.experiment.languages);
  const items = (await readFile(join(directory, "items.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => itemResultSchema.parse(JSON.parse(line)));
  if (items.some((item) => item.outcome === "truncated"))
    throw new Error("Truncated evidence is not publishable");
  return releaseEvidenceSchema.parse({
    schemaVersion: 1,
    releaseId: manifest.id,
    runCreatedAt: snapshot.createdAt,
    configHash: manifest.configHash,
    datasetManifestHash: manifest.files["dataset-manifest.json"],
    protocolHash: snapshot.protocolHash,
    configurations: snapshot.experiment.models.map(({ transport, model, maxOutputTokens }) => ({
      transport,
      model,
      maxOutputTokens,
    })),
    languages: manifest.languages.map((language) => {
      const selected = questions
        .filter((question) => question.language === language && question.split === "test")
        .sort((a, b) => a.id.localeCompare(b.id));
      const prompts = selected.map((question) => {
        const responses = items.filter(
          (item) => item.language === language && item.questionId === question.id,
        );
        const promptSet = new Set(responses.map((item) => item.prompt));
        if (
          promptSet.size !== 1 ||
          responses.length !== manifest.aggregate.reduce((sum, row) => sum + row.repeats, 0)
        )
          throw new Error("Incomplete or inconsistent public prompt evidence");
        return { question, prompt: responses[0]!.prompt };
      });
      return {
        language,
        n: selected.length,
        inputHash: hash(json(prompts)),
        alignmentHash: hash(
          json(
            selected.map(({ id, category, answer, options }) => ({
              id,
              category,
              answer,
              options: options.length,
            })),
          ),
        ),
        randomBaseline:
          selected.reduce((sum, question) => sum + 1 / question.options.length, 0) /
          selected.length,
      };
    }),
  });
}

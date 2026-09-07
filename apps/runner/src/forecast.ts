import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { itemResultSchema, type Experiment, type ItemResult } from "@llang-gap/contracts";
import { calculateCost } from "@llang-gap/providers";
import { readSnapshot } from "./snapshot";
import type { Job } from "./plan";

export function forecastCost(
  experiment: Experiment,
  jobs: readonly Job[],
  source: Experiment,
  items: readonly ItemResult[],
) {
  if (source.protocol !== experiment.protocol || source.dataset !== experiment.dataset)
    throw new Error("Calibration requires the same protocol and dataset");
  if (experiment.models.some((model) => !model.pricing))
    throw new Error("Cost forecasting requires target prices for every model");
  const conditions = experiment.models.flatMap((model) =>
    model.efforts.flatMap((effort) =>
      experiment.languages.map((language) => {
        const sourceModel = source.models.find(
          (m) =>
            m.transport === model.transport &&
            m.model === model.model &&
            m.efforts.includes(effort),
        );
        if (!sourceModel || sourceModel.maxOutputTokens !== model.maxOutputTokens)
          throw new Error(`Calibration model/effort/token cap mismatch: ${model.model}/${effort}`);
        const samples = items.filter(
          (r) =>
            r.transport === model.transport &&
            r.model === model.model &&
            r.effort === effort &&
            r.language === language,
        );
        if (!samples.length || samples.some((r) => r.usage === null))
          throw new Error(
            `Calibration requires recorded usage for every sample: ${model.model}/${effort}/${language}`,
          );
        const target = jobs.filter(
          (j) =>
            j.model.transport === model.transport &&
            j.model.model === model.model &&
            j.request.effort === effort &&
            j.request.language === language,
        );
        const averageCost =
          samples.reduce((sum, r) => sum + calculateCost(r.usage!, model.pricing)!, 0) /
          samples.length;
        const capCost =
          samples.reduce(
            (sum, r) =>
              sum +
              calculateCost(
                { ...r.usage!, outputTokens: model.maxOutputTokens, reasoningTokens: null },
                model.pricing,
              )!,
            0,
          ) / samples.length;
        return {
          transport: model.transport,
          model: model.model,
          effort,
          language,
          sampleResponses: samples.length,
          sampleQuestions: new Set(samples.map((r) => r.questionId)).size,
          sampleTruncated: samples.filter((r) => r.outcome === "truncated").length,
          requests: target.length,
          estimatedUsd: averageCost * target.length,
          outputCapScenarioUsd: capCost * target.length,
        };
      }),
    ),
  );
  return {
    method: "mean-observed-usage-per-model-effort-language",
    estimatedUsd: conditions.reduce((sum, c) => sum + c.estimatedUsd, 0),
    outputCapScenarioUsd: conditions.reduce((sum, c) => sum + c.outputCapScenarioUsd, 0),
    conditions,
    limitations:
      "One attempt per request, repriced using target configuration. Assumes the same mean input/output/cache usage as the calibration sample; question length and difficulty may differ. Output-cap scenario keeps observed input/cache usage and is not an upper bound or confidence interval. Technical retries and unknown charges are excluded. Small samples are provisional; repeated responses are not independent questions.",
  };
}

export async function readCalibration(
  directory: string,
  experiment: Experiment,
  jobs: readonly Job[],
  datasetHash: string,
) {
  const { snapshot } = await readSnapshot(directory);
  if (snapshot.datasetHash !== datasetHash) throw new Error("Calibration dataset hash mismatch");
  const db = new DatabaseSync(join(directory, "state.sqlite"), { readOnly: true });
  try {
    const unfinished = db
      .prepare("SELECT COUNT(*) AS n FROM jobs WHERE status != 'completed'")
      .get();
    if (unfinished?.n !== 0) throw new Error("Calibration run must be complete");
    const rows = db
      .prepare(
        "SELECT a.result FROM attempts a JOIN jobs j ON j.id = a.job_id WHERE a.status = 'completed' AND a.number = j.attempts",
      )
      .all();
    const items = rows.map((row) => itemResultSchema.parse(JSON.parse(String(row.result))));
    return {
      sourceRunId: snapshot.runId,
      ...forecastCost(experiment, jobs, snapshot.experiment, items),
    };
  } finally {
    db.close();
  }
}

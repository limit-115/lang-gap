import { validateAlignment, validateDataset } from "@llang-gap/datasets";
import type {
  DatasetManifest,
  Experiment,
  GenerationRequest,
  ModelConfig,
  ProtocolId,
  Question,
} from "@llang-gap/contracts";
import {
  buildPrompt,
  getProtocol,
  getAnswerFormat,
  getMaxOutputTokens,
  getPromptLabels,
  getStopSequences,
  validateProtocolDataset,
  shuffled,
  toPromptQuestion,
} from "@llang-gap/evaluation";
import { reserveCost } from "@llang-gap/providers";
import { hash } from "./files";

export interface Job {
  protocol: ProtocolId;
  id: string;
  questionId: string;
  category: string;
  repeat: number;
  expected: string;
  optionCount: number;
  model: ModelConfig;
  request: GenerationRequest;
  reservationUsd: number | null;
}

export function createJobs(
  experiment: Experiment,
  questions: readonly Question[],
  configHash: string,
  manifest?: DatasetManifest,
): Job[] {
  getProtocol(experiment.protocol);
  validateProtocolDataset(experiment.protocol, experiment.dataset, experiment.languages, manifest);
  validateDataset(questions, undefined, experiment.languages);
  for (const pair of experiment.comparisons)
    validateAlignment(questions, pair.baseline, pair.language);
  const cap = getMaxOutputTokens(experiment.protocol);
  if (cap !== undefined && experiment.models.some((model) => model.maxOutputTokens !== cap))
    throw new Error(
      `Selected protocol requires a ${cap}-token cap; a different cap needs a separate protocol`,
    );
  const ids = [
    ...new Set(
      questions
        .filter((q) => q.split === "test" && experiment.languages.includes(q.language))
        .map((q) => q.id),
    ),
  ].sort();
  const orderedIds = shuffled(ids, experiment.seed);
  // Shared ordering gives aligned conditions the same pilot subset, while independent
  // language sets retain their own requested sample size.
  const testKeys = new Set(
    questions.filter((q) => q.split === "test").map((q) => `${q.id}/${q.language}`),
  );
  const selectedByLanguage = new Map(
    experiment.languages.map((language) => [
      language,
      new Set(
        orderedIds
          .filter((id) => testKeys.has(`${id}/${language}`))
          .slice(0, experiment.questionLimit),
      ),
    ]),
  );
  const selectedIds = orderedIds.filter((id) =>
    [...selectedByLanguage.values()].some((set) => set.has(id)),
  );
  const test = new Map(
    questions.filter((q) => q.split === "test").map((q) => [`${q.id}/${q.language}`, q]),
  );
  const validation = questions.filter((q) => q.split === "validation");
  const prompts = new Map<string, string>();
  const pairs: Job[][] = [];
  for (const id of selectedIds) {
    for (const model of experiment.models) {
      for (const effort of model.efforts) {
        for (let repeat = 0; repeat < experiment.repeats; repeat++) {
          const pair = experiment.languages
            .filter((language) => selectedByLanguage.get(language)!.has(id))
            .map((language) => {
              const q = test.get(`${id}/${language}`);
              if (!q) throw new Error(`Missing selected question ${id}/${language}`);
              const promptKey = `${id}/${language}`;
              let prompt = prompts.get(promptKey);
              if (prompt === undefined) {
                prompt = buildPrompt(
                  toPromptQuestion(q),
                  validation,
                  experiment.protocol,
                  getPromptLabels(manifest, language),
                );
                prompts.set(promptKey, prompt);
              }
              const stopSequences = getStopSequences(experiment.protocol, language);
              const request: GenerationRequest = {
                model: model.model,
                effort,
                language,
                maxOutputTokens: model.maxOutputTokens,
                prompt,
                ...(stopSequences ? { stopSequences } : {}),
                answerFormat: getAnswerFormat(experiment.protocol, language),
              };
              const key = [configHash, model.transport, model.model, effort, id, language, repeat];
              return {
                protocol: experiment.protocol,
                id: hash(JSON.stringify(key)),
                questionId: id,
                category: q.category,
                repeat,
                expected: q.answer,
                optionCount: q.options.length,
                model,
                request,
                reservationUsd: reserveCost(request, model.pricing),
              };
            });
          // Keep language conditions adjacent; rotate the first condition to distribute time drift.
          const offset = pairs.length % pair.length;
          pairs.push([...pair.slice(offset), ...pair.slice(0, offset)]);
        }
      }
    }
  }
  return shuffled(pairs, experiment.seed).flat();
}

export function summarizePlan(experiment: Experiment, jobs: readonly Job[]) {
  const attemptBound = jobs.some((job) => job.reservationUsd === null)
    ? null
    : jobs.reduce((sum, j) => sum + j.reservationUsd!, 0);
  return {
    experiment: experiment.id,
    synthetic: experiment.models.every((m) => m.transport === "fake"),
    dataset: experiment.dataset,
    languages: experiment.languages,
    comparisons: experiment.comparisons,
    questionsPerLanguage: Object.fromEntries(
      experiment.languages.map((language) => [
        language,
        new Set(jobs.filter((j) => j.request.language === language).map((j) => j.questionId)).size,
      ]),
    ),
    repeats: experiment.repeats,
    configurations: experiment.models.reduce((sum, m) => sum + m.efforts.length, 0),
    requests: jobs.length,
    maxAttemptsPerRequest: experiment.execution.maxAttempts,
    upperBoundUsdOneAttempt: attemptBound,
    upperBoundUsdAllAttempts:
      attemptBound === null ? null : attemptBound * experiment.execution.maxAttempts,
    note: "upperBoundUsd fields are safety reservations, not spending forecasts. Use --calibrate-from for an empirical forecast. Missing prices produce null bounds. Cost planning and a USD budget are optional.",
  };
}

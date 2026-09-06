import type {
  Experiment,
  GenerationRequest,
  ModelConfig,
  ProtocolId,
  Question,
} from "@llang-gap/contracts";
import {
  buildPrompt,
  getProtocol,
  protocol,
  shuffled,
  toPromptQuestion,
} from "@llang-gap/evaluation";
import { reserveCost } from "@llang-gap/providers";
import { hash } from "./files";

export interface Job {
  protocol?: ProtocolId;
  id: string;
  questionId: string;
  category: string;
  repeat: number;
  expected: string;
  optionCount: number;
  model: ModelConfig;
  request: GenerationRequest;
  reservationUsd: number;
}

export function createJobs(
  experiment: Experiment,
  questions: readonly Question[],
  configHash: string,
): Job[] {
  getProtocol(experiment.protocol);
  const authorProtocol = experiment.protocol === protocol.id;
  if (
    authorProtocol &&
    experiment.models.some((m) => m.maxOutputTokens !== protocol.generation.maxGenTokens)
  )
    throw new Error(
      "Author API protocol requires a 2048-token cap; a different cap needs a separate protocol",
    );
  const ids = [...new Set(questions.filter((q) => q.split === "test").map((q) => q.id))].sort();
  const selectedIds = shuffled(ids, experiment.seed).slice(
    0,
    experiment.questionLimit ?? ids.length,
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
          const pair = experiment.languages.map((language) => {
            const q = test.get(`${id}/${language}`);
            if (!q) throw new Error(`Missing paired question ${id}/${language}`);
            const promptKey = `${id}/${language}`;
            let prompt = prompts.get(promptKey);
            if (prompt === undefined) {
              prompt = buildPrompt(toPromptQuestion(q), validation, experiment.protocol);
              prompts.set(promptKey, prompt);
            }
            const request: GenerationRequest = {
              model: model.model,
              effort,
              language,
              maxOutputTokens: model.maxOutputTokens,
              prompt,
              ...(authorProtocol ? { stopSequences: protocol.generation.until[language] } : {}),
            };
            const key = [configHash, model.provider, model.model, effort, id, language, repeat];
            return {
              ...(authorProtocol ? { protocol: experiment.protocol } : {}),
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
          // Adjacent language pairs minimize time drift; alternate which language goes first.
          pairs.push(pairs.length % 2 === 0 ? pair : [...pair].reverse());
        }
      }
    }
  }
  return shuffled(pairs, experiment.seed).flat();
}

export function summarizePlan(experiment: Experiment, jobs: readonly Job[]) {
  const attemptBound = jobs.reduce((sum, j) => sum + j.reservationUsd, 0);
  return {
    experiment: experiment.id,
    synthetic: experiment.models.every((m) => m.provider === "fake"),
    questionsPerLanguage: new Set(jobs.map((j) => j.questionId)).size,
    repeats: experiment.repeats,
    configurations: experiment.models.reduce((sum, m) => sum + m.efforts.length, 0),
    requests: jobs.length,
    maxAttemptsPerRequest: experiment.execution.maxAttempts,
    upperBoundUsdOneAttempt: attemptBound,
    upperBoundUsdAllAttempts: attemptBound * experiment.execution.maxAttempts,
    note: "Conservative token-cap bound, not a predicted invoice. Live runs require an explicit USD budget.",
  };
}

# MMLU-ProX Lite prompt protocols

The selected protocol object in `packages/evaluation/src/prompts.ts` and its full
prompt reference are hashed into every run. Both versions use parser
`terminal-answer-v1` and the same scoring and statistics.

## Pinned inputs

- Dataset: [li-lab/MMLU-ProX-Lite](https://huggingface.co/datasets/li-lab/MMLU-ProX-Lite/tree/e82aafb9460529687d3c7e51b401d8dd1dd309dd),
  revision `e82aafb9460529687d3c7e51b401d8dd1dd309dd`.
- Reference: [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness/tree/b954108c9baaaa934b4ad842033b31a97ee30816/lm_eval/tasks/mmlu_prox),
  revision `b954108c9baaaa934b4ad842033b31a97ee30816`.
- Test: 588 aligned questions per language. Validation: five examples in each of
  14 subjects, 70 total. Validation does not contribute to accuracy.

`packages/evaluation/reference/` retains the unmodified language labels, EN/RU
formatting functions, YAML descriptions and decoding templates with the upstream
MIT notice. `src/reference.json` contains their resolved labels/descriptions.
Synthetic golden prompts in `fixtures/` were generated using the pinned Python
`format_cot_example` function; tests compare the TypeScript output byte for byte.

## V1 prompt construction (preserved)

`mmluprox-lite-5shot-native-reasoning-v1` keeps its existing object, hash and prompt
bytes. Existing experiment files remain on v1 unless explicitly changed.

1. The exact localized YAML subject description.
2. The five validation examples from that subject in source order, using the
   reference formatting function and localized CoT-prefix replacement.
3. The test question, original option labels and localized reasoning prefix.

The target is projected to a type without `answer` or `cot`; formatting cannot
inspect those fields. A new independent **single user message** is sent per test,
language, model, effort and repeat. No system instruction, history, tools, web
search or cross-question context is added. Native internal reasoning is handled
by the provider and is not required for scoring.

## V2 prompt construction

`mmluprox-lite-5shot-native-reasoning-v2` addresses a failure seen in the small
GPT-5 nano pilot: some responses solved the five worked examples again and ended
with a list of answers, which the terminal-answer parser could not score.

V2 replaces the plural subject description and trailing reasoning prefix with
matching EN/RU instructions. The exact same five source examples remain in source
order inside a localized solved-examples block. A separate block contains only
the target question and options. The final instruction asks the model to solve
only that target, give brief reasoning if needed, and finish with exactly
`The answer is (X).` or `Ответ - (X).`, replacing X with its chosen letter.
All new instructions and delimiters are included in the v2 protocol hash. Golden
fixtures cover both languages; target gold labels and solutions remain excluded.

This is a new experiment condition. Do not pool v1 and v2 results or reinterpret
old outputs with a more permissive parser. The original v1 run remains evidence
of its original conditions. A protocol version alone does not establish that a
model follows its instructions; inspect a bounded pilot before any full run.

## Explicit adaptations

| Reference behavior                                | This protocol                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| `temperature: 0`, greedy generation               | Native model reasoning API; no unsupported sampling override          |
| 2,048 generated tokens                            | Same configured reasoning-inclusive cap within each EN/RU pair        |
| Text-completion stop strings                      | Provider completion status; no stop-sequence override                 |
| Regex extracts the first matching marker anywhere | A terminal localized marker is required; the last terminal match wins |
| Harness text input / optional chat template       | Exact assembled text in one user message                              |

This is an adapted experiment, not a claim to reproduce the paper's scores.

The parser accepts `the answer is (X)` in English and `Ответ - (X)` in Russian,
case differences, common Unicode dashes, optional parentheses, simple Markdown
bold wrappers and terminal punctuation/whitespace. The letter must exist among
the available options. A bare letter or ambiguous trailing alternatives fail.
Wrong-language markers fail. The full visible text remains available for audit.

Wrong, refused or unparseable completed answers score zero, without retries.
Truncation also scores zero but blocks release. Missing technical outcomes never
become scored incorrect answers. Increasing a cap requires a fresh complete run
for the affected comparison, without selectively retaining improved answers.

## Metrics

Each question has equal weight. Accuracy averages correctness across all questions
and all prespecified repeats. There is no majority vote or best-of selection.

`gapPp = 100 × (accuracy_en − accuracy_ru)`

Positive values indicate lower Russian accuracy. Always report absolute English
and Russian accuracy alongside the gap. Unparseable answers and refusals have
separate counters.

For each model/effort, the paired percentile bootstrap samples **unique question
IDs**, retaining both languages and all repeats in each sampled cluster. There
are 10,000 samples from a deterministic seeded generator. The 2.5th and 97.5th
percentiles use linear interpolation. Input ordering does not change the result.
`N=588` is the number of unique questions; three repeats are not 1,764 independent
questions. Per-repeat EN/RU accuracies are exported separately.

An interval containing zero does not establish the direction of the difference.
This measures question-set variability under this protocol, not all uncertainty
from translation, training contamination, model drift or API sampling.

## Models and prices

The capabilities registry supports `gpt-6-astra`, `claude-fable-5-1`, and
`gpt-5-nano` / pinned `gpt-5-nano-2025-08-07` at low, medium and high effort,
following their provider documentation. OpenAI uses
Responses `reasoning.effort`; Anthropic uses adaptive thinking and
`output_config.effort`. Effort names do not equate compute across providers.
Requested and returned model IDs are recorded. API availability is checked only
when an operator explicitly runs a paid pilot; it has not been established by CI.

The experiment embeds dated standard-tier pricing from
[OpenAI](https://developers.openai.com/api/docs/pricing) and
[Anthropic](https://platform.claude.com/docs/en/models/fable-5-1/overview).
Per-item `costUsd` and aggregate `costUsd` describe selected completed responses.
The separate attempt ledger and execution summary include failed/uncertain
attempts and reservations; they are the authoritative view of total run spending.

## Limits

This benchmark measures academic multiple-choice accuracy, not all language
capability. Public dataset exposure, translation defects, subject balance and
small sample size can influence results. Provider aliases can drift, and exact
reproduction of stochastic API output is not guaranteed. Published artifacts do
allow deterministic independent reproduction of the scoring and statistics.

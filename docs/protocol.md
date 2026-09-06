# MMLU-ProX Lite: author protocol with native API adaptations

The primary configuration uses `mmluprox-lite-5shot-author-api-v3`, parser
`mmluprox-regex-first-v1`. The complete protocol object in
`packages/evaluation/src/prompts.ts` is hashed into each new run. This is a new
condition; v1/v2 outputs and scores must not be relabelled, rescored or pooled with it.

## Pinned sources and unchanged data

The [authors' reproduction instructions](https://github.com/weihao1115/MMLU-ProX/blob/e3f49f78074502422a5c9eb0306ff62c4c99d76d/README.md#usage)
point to EleutherAI's harness and a vLLM text-generation command (without a chat
template flag), with vLLM 0.7.3, except Llama3.1-405B on 0.6.6. They do not pin a
harness commit. We retain the already pinned, reviewed harness revision
[`b954108c9baaaa934b4ad842033b31a97ee30816`](https://github.com/EleutherAI/lm-evaluation-harness/tree/b954108c9baaaa934b4ad842033b31a97ee30816/lm_eval/tasks/mmlu_prox),
which was also upstream HEAD when checked on 2026-09-06. This fixes the linked
implementation, without claiming it is the exact historical code used for the paper.

Dataset: [li-lab/MMLU-ProX-Lite](https://huggingface.co/datasets/li-lab/MMLU-ProX-Lite/tree/e82aafb9460529687d3c7e51b401d8dd1dd309dd),
revision `e82aafb9460529687d3c7e51b401d8dd1dd309dd`. The manifest, four Parquet hashes,
normalizer, translations, question IDs, option order/text and gold answers are
unchanged. All **588 aligned test questions per language** remain in the primary
plan. The 70 validation rows (five in each of 14 subjects) are demonstrations only.
Screening concerns are dataset limitations, not a reason to correct keys,
translate again, filter questions or create a favourable subset in this comparison.

## Author prompts and five examples

The exact localized subject description comes from the vendored Lite YAML.
`process_docs` filters the validation split to the subject; `FirstNSampler`
selects its first five rows in source order. There is no random sampling, ID sort,
answer balancing, rewriting of solutions or selection based on model performance.
EN/RU use their pinned corresponding rows. The normalizer preserves source order.

Each example uses upstream `format_cot_example`: localized question/options labels,
original A–J options, the original `cot_content` with its localized CoT-prefix
replacement, and two trailing newlines. The target has the same formatting and
localized reasoning prefix, with no gold answer or solution. The complete prompt
is the description + five examples + target. These bytes already matched v1 and
are retained. V2's extra headings, target-only instruction and rewritten marker
instruction are absent. The target is projected to a type without `answer`/`cot`.

The complete context path was checked through `ConfigurableTask.fewshot_context`,
`build_qa_turn` and `Message.to_text`, including the empty few-shot target. No extra
separator is added to the two newlines supplied by the task formatter.

## Exact extraction and scoring

The [EN template](https://github.com/EleutherAI/lm-evaluation-harness/blob/b954108c9baaaa934b4ad842033b31a97ee30816/lm_eval/tasks/mmlu_prox/en/_en_lite_template_yaml)
and [RU template](https://github.com/EleutherAI/lm-evaluation-harness/blob/b954108c9baaaa934b4ad842033b31a97ee30816/lm_eval/tasks/mmlu_prox/ru/_ru_lite_template_yaml)
apply `RegexFilter` followed by `take_first`:

- EN: `answer is \(?([ABCDEFGHIJ])\)?`
- RU: `Ответ - \(?([ABCDEFGHIJ])\)?`

The regex is **case-sensitive** with literal spaces and ASCII hyphen. The first
match anywhere wins, including an earlier marker followed by explanation,
alternatives or another answer. Parentheses are independently optional. There is
no terminal-position requirement, case folding, Markdown removal, Unicode-dash
normalization, bare-letter fallback, word boundary or option-count filter.
For example, EN `answer is (J)` is extracted even on a four-option question and
then scores incorrect against its valid gold label. Lowercase `b` does not match.
`ignore_case`/`ignore_punctuation` in the exact-match metric act on the extracted
letter, not on the input to the regex; they do not make extraction case-insensitive.

`take_first` takes the first generated response, not the last answer marker or a
majority vote. No match becomes upstream `[invalid]`; our result schema represents
that as `answer: null`, with the same zero score. Scoring compares the captured
uppercase letter with the unchanged gold letter. All returned visible text,
including cap-limited or refusal-tagged output, follows this rule; empty/refusal
text without a match scores zero. API status remains separately recorded. Native
thinking blocks are not exposed to this parser.

Before extraction, the visible output is cut at the earliest task stop, as in the
[harness postprocessor](https://github.com/EleutherAI/lm-evaluation-harness/blob/b954108c9baaaa934b4ad842033b31a97ee30816/lm_eval/models/utils.py#L943):
EN `</s>`, `Q:`, `Question:`, `<|im_end|>`; RU substitutes `Вопрос:` for `Question:`.
Stops are case-sensitive and apply anywhere. The raw visible output is preserved
in `items.jsonl`; clipping affects scoring only. There is no invented reasoning-tag
stripper or additional localized stop. Provider EOS termination is handled by the API.

## Generation: matched settings and API limits

The author task requests `do_sample: false`, `temperature: 0.0`,
`max_gen_toks: 2048` and the stops above. The primary MVP, pilot and fake-smoke
configurations now set **2048**, replacing the discretionary 16,384 cap. Planning
rejects a different cap under this protocol ID. This preserves the numeric limit,
but does not promise 2048 visible tokens or equal compute across models.

| Setting        | Author harness                                  | Native API implementation / remaining difference                                                                                                                                                                                                                                                                               |
| -------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Input          | vLLM text completion under the authors' command | One independent user message containing the exact assembled text; provider chat framing and tokenizer are not controlled. No system prompt, history or tools are added.                                                                                                                                                        |
| Decoding       | Greedy, temperature zero                        | Astra and Fable 5.1 reject these sampling overrides. Native low/medium/high efforts remain explicit; default sampling is not claimed to be greedy or deterministic.                                                                                                                                                            |
| Token cap      | 2048 model-generated tokens                     | Both APIs receive 2048, including hidden reasoning. They provide no independent visible-only token budget. No cap increase or prompt shortening is automatic.                                                                                                                                                                  |
| Stop sequences | Task stops plus the model EOS                   | Anthropic receives the task stops and a requested `stop_sequence` is a completed outcome. OpenAI Responses has no stop parameter, so visible stops are applied locally. Both use local clipping before extraction. Extra OpenAI generation can consume tokens/cost; server-side EOS and hidden reasoning cannot be reproduced. |
| Response text  | Text returned by the pinned vLLM backend        | Only visible API text is available; hidden reasoning cannot be scored or reconstructed.                                                                                                                                                                                                                                        |
| Reproduction   | Authors' models, weights and vLLM versions      | Hosted models, aliases, native effort and provider infrastructure differ. Exact paper scores are not claimed.                                                                                                                                                                                                                  |

Sources checked 2026-09-06: [Astra sampling restrictions](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra),
[Responses request schema](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create),
[Claude thinking restrictions and token accounting](https://platform.claude.com/docs/en/build-with-claude/thinking),
[Messages stop sequences](https://platform.claude.com/docs/en/api/messages/create).
The pinned SDK request types and intercepted HTTP tests verify the actual request
bodies. Documentation/schema support is not a claim of account access or a live test.

Separate **project policies**, not unavoidable API restrictions: native effort
conditions, three prespecified repeats, paired scheduling and bootstrap estimates
extend the authors' task. The existing release gate still blocks any truncated
response or missing technical outcome. A cap-limited response is scored with the
reference regex in the run journal, but the complete comparison remains unpublished;
no item is removed to pass the gate. Increasing the cap requires a separately named,
reviewed protocol and fresh run, not replacement of selected responses. Unparseable
answers remain zero and do not justify a 100% format-success gate or prompt tuning.

## Historical v1/v2 and offline evidence

V1 (`mmluprox-lite-5shot-native-reasoning-v1`) keeps its exact protocol-object hash
`266ad9bd948de36b5933d17cdcd131fa830a4622a40ab557cebc8e73045f4f74`, prompt bytes and
`terminal-answer-v1` semantics, including its special refusal/truncation handling.
Runner execution, snapshots and release verification dispatch by recorded protocol;
changing the YAML default cannot reinterpret an old run. The implementation hash
still requires the original source/dependency checkout to resume or verify old runs.

[PR #16](https://github.com/limit-115/llang-gap/pull/16), commit
`8524ce0eb5bf20ae2b056d1b1400226c28f580f1`, contains the experimental v2 prompts,
stratified nano pilot and its historical audit. V2 retains v1's stricter parser.
Its code/configuration, journal and immutable test release stay at their original
revision; v2 is not imported into the active plan or silently migrated here.
This change does not replay or rescore any historical outputs. Retain that checkout
and lockfile for v2 verification. In particular, its reported nonterminal failure
is evidence under v2, not a reason to rewrite the author's task.

The [first-comparison plan](first-comparison.md) supersedes the proposed v2 baseline,
100% format gate and input-correction requirement in [PR #12](https://github.com/limit-115/llang-gap/pull/12).
Neither earlier PR is a prerequisite for this primary plan; their branches remain intact.

`fixtures/harness-parity.json` records 28 synthetic full-prompt hashes and 92
regex/stop cases from the pinned Python implementation. Offline Vitest checks them,
all vendored subject descriptions/decoding templates, source-order selection,
target-answer exclusion, legacy v1 compatibility and versioned run/release behavior.
Regenerate the fixture from a local copy of the pinned harness source:

```sh
python3 scripts/generate-harness-fixtures.py /path/to/lm-evaluation-harness
pnpm exec oxfmt packages/evaluation/fixtures/harness-parity.json
pnpm exec vitest run packages/evaluation apps/runner packages/providers
```

The generator checks source SHA-256 values in `reference/harness-files.json` and
executes upstream method bodies via AST without importing model backends. Inputs
are synthetic; no dataset downloads or model calls occur. The existing MIT notice
covers the vendored harness reference. Dataset/source pins are unchanged.

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

The initial capabilities registry supports `gpt-6-astra` and `claude-fable-5-1` at
low, medium and high effort, following their provider documentation. OpenAI uses
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

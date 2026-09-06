# First EN/RU comparison readiness

As of **2026-09-06**, the full run is **NOT AUTHORIZED**. This guide, a ready
configuration, passing checks, or a pilot does not grant execution permission.
See the [protocol](protocol.md), [operator guide](runner.md), and [release guide](releases.md) for procedures.

## Scope and candidates

The first comparison covers **588 aligned test questions** in EN/RU, 14 subjects,
and six model/effort configurations. Five validation examples per subject are unscored.

| Provider  | Exact candidate ID | Three configurations    | Native request controls                            |
| --------- | ------------------ | ----------------------- | -------------------------------------------------- |
| OpenAI    | `gpt-6-astra`      | `low`, `medium`, `high` | Responses `reasoning.effort`                       |
| Anthropic | `claude-fable-5-1` | `low`, `medium`, `high` | Messages `output_config.effort`, adaptive thinking |

Official documentation lists [Astra's ID/capabilities](https://developers.openai.com/api/docs/models/gpt-6-astra) and [Fable 5.1 as active](https://platform.claude.com/docs/en/models/fable-5-1/overview).
Both accept text input and output and support these efforts plus `xhigh` and `max`;
Fable's adaptive thinking is always on. [Claude effort](https://platform.claude.com/docs/en/build-with-claude/effort)
and OpenAI effort are provider-native controls, not equal compute budgets.
An unavailable candidate blocks its comparison pending an explicit scope revision.

| Prespecified repeats | Requests per model/effort | Total requests, excluding retries |
| -------------------- | ------------------------- | --------------------------------- |
| 1                    | `588 × 2 = 1,176`         | `588 × 2 × 6 = 7,056`             |
| 3 (current proposal) | `588 × 2 × 3 = 3,528`     | `588 × 2 × 6 × 3 = 21,168`        |

Three repeats still mean **588 unique question clusters**. Prespecify repeats and
average correctness without majority-vote or best-of selection.
Report EN/RU accuracy and paired gap intervals together.

## Freeze before any full-run decision

`experiments/comparison-v2.yaml` ([core PR #16](https://github.com/limit-115/llang-gap/pull/16)) prepares `comparison-en-ru-v2` only,
using `mmluprox-lite-5shot-native-reasoning-v2`. The [MVP configuration](../experiments/mvp.yaml) remains v1.
Freeze the reviewed configuration and clean commit: dataset/reference revisions and hashes,
question IDs, prompt/parser versions and hashes, exact requested model IDs, native efforts,
repeats, seed, SDK/Node/lockfile versions, endpoints, dated rates, scheduling and retries.
Record returned model IDs. Preparation grants no full-run execution permission.

Current proposed settings are seed `20260906`, three repeats, a 16,384-token
reasoning-inclusive output cap, concurrency two per provider, three maximum
attempts, and a 600,000 ms timeout. The cap is **unvalidated for the candidates**.
Keep each EN/RU pair's cap identical. Use independent questions without tools,
history, target-answer leakage, or unsupported sampling overrides. A changed
prompt, parser, cap, model, subset, repeat count, or seed requires a new run identity;
never selectively rerun wrong or unparseable completed answers to improve scores.

## Scientific and operational go/no-go

- **Current calibration only:** `experiments/pilot-nano-v2.yaml` completed 168/168 requests:
  28 paired questions, two per subject, three efforts, one repeat. **167/168 parsed**;
  one EN/medium answer was nonterminal. Zero errors, retries, truncations or refusals.
  The 100% format gate failed: readiness is blocked; this calibration is not a benchmark.
- **Format gate:** require complete paired pilot outcomes, 100% expected answer
  format success, zero truncations, and no missing technical outcomes. Manually
  reconcile parser decisions with visible answers; document refusals separately.
  Unexplained discrepancies block readiness; wrong answers do not justify retries.
- **Data-quality gate:** seven screening flags remain; resolve logged answer-key/translation
  issues before an authoritative comparison and version corrected inputs/protocol. Audit:
  `docs/nano-pilot-v2.md` in [core PR #16](https://github.com/limit-115/llang-gap/pull/16).
  Agent-based screening is not independent native-speaker or domain-expert validation.
- **Candidate gate:** nano success does not establish Astra/Fable behavior or an
  adequate cap. Each candidate/effort needs separately authorized bounded
  calibration with the frozen protocol, both languages and subject coverage.
  Cap or format repairs require fresh paired calibration before a full-run decision.
- **Provenance gate:** commit v2/configuration, pass offline checks, and preserve
  the clean run identity and immutable artifacts. Independently verify a complete
  matrix without truncations; show limitations, dated models and identical EN/RU numbers.
- **Access/budget gate:** only OpenAI provider access has been verified in prior
  bounded work. Access to these exact candidates, Anthropic access, quotas and an
  agreed full-run budget are not established. Passing every gate grants no permission.

## Dated rates, not a spend prediction

USD per million tokens, standard direct API rates checked **2026-09-06**:

| Candidate | Uncached input | Cache read | Cache write           | Output, including reasoning |
| --------- | -------------- | ---------- | --------------------- | --------------------------- |
| Astra     | $10            | $1         | $12.50                | $50                         |
| Fable 5.1 | $10            | $0.25      | $12.50 (5m), $20 (1h) | $50                         |

Sources: [OpenAI pricing](https://developers.openai.com/api/docs/pricing) and [Anthropic pricing](https://platform.claude.com/docs/en/models/fable-5-1/overview#pricing).
Astra prompts above 272K input tokens use 2× input/cache and 1.5× output rates;
keep the proposed short-context comparison within its supported bound.

For each attempt: `USD = (U × inputRate + R × readRate + W × writeRate + H × oneHourWriteRate + O × outputRate) / 1,000,000`.
`U/R/W/H` are disjoint uncached/read/short-write/one-hour-write token buckets;
`O` already includes billed reasoning. Sum known attempt costs and retain unknown
attempt reservations separately. Cache hits and repeat costs are not assumed.
Only candidate-specific pilot usage can inform a later forecast and agreed budget.

## Refresh cadence

Update readiness after format/data issues are resolved. Next official model/rate review:
**2026-09-13**, then weekly. Propose a monthly comparison refresh review, first
**2026-10-06**, and an earlier review for a material model release or correction.
Each refresh needs current sources, a frozen protocol, gates and explicit run
authorization. Preserve dated releases and explain protocol breaks. These review
targets do not schedule API jobs. **The full run remains NOT AUTHORIZED.**

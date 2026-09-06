# GPT-5 nano v2 calibration — 2026-09-06

**Calibration completed; full-comparison readiness did not pass. No full run was
started or authorized.** The 28-question pilot produced 168 real responses with
one terminal-format failure and no truncations. Dataset screening also identified
answer-option and translation issues. These scores are diagnostic, not a ranking.

## Frozen scope and evidence

- Config: [pilot-nano-v2.yaml](../experiments/pilot-nano-v2.yaml), two seeded
  questions from each of 14 subjects, EN/RU, low/medium/high, one repeat.
- Requested and every returned model: `gpt-5-nano-2025-08-07`.
- Run: `pilot-nano-en-ru-v2-2026-09-06-0197c5dd`.
- Clean source commit: `7f34dd8d91451d5061a3c080fc17ffbb143e24f2`.
- Runtime fingerprint: `f8c965d5cb751803568662451d68297712d21780178a367f649a7a94d89eb043`.
- V2 protocol hash: `c0ff40f21a913c5822aeb71d1b7341e1f6512e772b7eeb12de1a7610bd36602d`.
- Dataset/reference revisions and all sent prompts are frozen in `resolved.json`
  and the immutable local audit artifacts. See [protocol](protocol.md) for pins.
- Execution used a **$0.80 total cap**, a 168-job ceiling and 16,384 output tokens
  per response, including internal reasoning. There were exactly 168 attempts:
  no API errors, retries, uncertain attempts, refusals or truncations.
  Maximum observed output was 15,894 tokens at high effort.
- Usage-based standard-tier cost: **$0.16377229**, using the config's dated
  [OpenAI rates](https://developers.openai.com/api/docs/pricing). This is not an
  account invoice or a claim about credits/free allowances.

The runner rescored all saved visible outputs, reproduced cost/statistics and
built then independently verified test release `pilot-nano-v2-2026-09-06`.
Its ten checksummed assets stay under `.llang-gap/releases/`; private run state,
raw responses and dataset exports are not committed. The public index is unchanged.
The [release guide](releases.md) explains local verification; this release's
`kind: test` and subset configuration prevent benchmark publication.

## Diagnostic scores under the unchanged scorer

| Effort | EN correct    | RU correct    | EN − RU, pp | Paired 95% interval, pp | Cost, USD  |
| ------ | ------------- | ------------- | ----------- | ----------------------- | ---------- |
| low    | 19/28 (67.9%) | 16/28 (57.1%) | +10.7       | −10.7 to +32.1          | 0.01427271 |
| medium | 21/28 (75.0%) | 20/28 (71.4%) | +3.6        | −10.7 to +17.9          | 0.05172655 |
| high   | 21/28 (75.0%) | 20/28 (71.4%) | +3.6        | −7.1 to +14.3           | 0.09777303 |

Every interval contains zero. Equal subject sampling differs from the full
question-weighted benchmark. The previous v1 demo used a different 12-question
sample; differences between the two pilots cannot be attributed solely to v2.
No failed, wrong or disputed result was selectively repeated or corrected.

## Visible-output audit

All 168 visible outputs and parser decisions were inspected. **167/168 (99.4%)**
matched the terminal-answer format. The remaining EN/medium response for
`test:ori_mmlu-professional_law:949` began `The answer is (E).` and then explained
its choice. The strict terminal parser correctly rejected it and scored zero,
even though that visible letter matches the source gold. This is model format
noncompliance, not a parser extraction defect; the parser was not relaxed.

No response re-solved the five worked examples. Nevertheless, the proposed 100%
format gate is not met. Any future prompt/parser change needs a new version and
fresh paired calibration. Zero truncations here does not validate the cap on
Astra/Fable or on all questions.

## Bilingual question screening

An agent read the stems and every option in all 28 EN/RU pairs. This is **not
independent native-speaker or subject-expert validation** of translations or gold
answers. Pair categories, option counts and annotated gold letters align; that
does not establish semantic correctness. Seven questions were flagged:

- `test:ori_mmlu-electrical_engineering:11577`: EN's two uses of “surge” disappear
  in RU; “half cycle surge current rating” becomes “номинальный ток полупериода”.
  This loses a specified operating regime. Annotated gold: A.
- `test:ori_mmlu-high_school_statistics:8339`: E (`μ2−μ1<0`) and I (`μ1−μ2>0`)
  are algebraically identical in both languages, but only I is the gold label.
- `test:stemez-Business:352`: with the stated rates and divisible operating time,
  2,700 type I plus 588 type Y units take about 23.463 hours and cost $4,004.40,
  within the stated limits. Gold E gives 585 type Y; the higher feasible count
  is absent. Shared wording/options need review before asserting a unique optimum.
- `test:ori_mmlu-computer_security:10397`: RU removes the stem's explicit “digest”
  cue; option B is “Message digest”, while gold G is “Modication detection code”.
  The terminology and overlap need expert review, not automatic relabeling.
- `test:ori_mmlu-professional_law:949`: option F renders “failure to render aid”
  as “неспособность оказать помощь”, shifting omission toward inability.
  Legal review is required to assess this distractor. Annotated gold: E.
- `test:ori_mmlu-high_school_physics:9723`: symmetric charge-halving options A/D
  and annotated H (halving B's mass) need subject review. No replacement gold
  was established by this screening.
- `test:ori_mmlu-professional_psychology:2650`: options B/H/I overlap in
  person-versus-situation attribution; annotated H needs uniqueness review.

Source questions and gold labels remain unchanged. Log and resolve flags with
independent review, version any corrections, and freeze the chosen dataset before
an authoritative comparison. The other screened items are not certified valid.

## Readiness decision

The [full v2 configuration](../experiments/comparison-v2.yaml) is a proposal only.
Resolve the format and data-quality gates, then separately calibrate exact
candidate models and validate access, cap and spending. Nano cost cannot predict
frontier-model cost. **A full run still requires explicit authorization.**

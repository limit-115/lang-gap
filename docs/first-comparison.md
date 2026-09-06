# First EN/RU comparison plan

The primary baseline is `mmluprox-lite-5shot-author-api-v3` in
[experiments/mvp.yaml](../experiments/mvp.yaml). It uses the author prompts,
first five subject validation examples in source order, exact first-match regex,
localized stops and the numeric 2048-token generation cap. The
[protocol](protocol.md) records source pins, verified behavior and API limitations.
**No full or paid run is authorized by this plan.**

## Fixed scope

All 588 aligned test questions in EN/RU, all 14 subjects and unchanged validation
examples remain. Do not edit translations, answer options, gold answers or the
normalizer, and do not exclude flagged questions. Translation/answer-key concerns
remain documented dataset limitations. They are not a requirement to create
corrected inputs before evaluating this fixed dataset.

Candidates remain `gpt-6-astra` and `claude-fable-5-1`, each at native low, medium
and high effort. Three prespecified repeats yield
`588 × 2 × 6 × 3 = 21,168` requests before technical retries. This is 588 unique
question clusters, not 1,764 independent questions. No majority vote or best-of
selection is used. Model IDs, effort and prices are dated configuration inputs;
account access and candidate performance have not been established by offline tests.

Freeze a clean commit, the reviewed experiment, dataset/reference hashes, protocol
hash, parser version, model IDs, SDK/Node/lockfile versions, seed, repeats, endpoints
and dated pricing before any separately authorized run. Each pair uses the same
2048-token cap. Hidden reasoning consumes it; the cap does not reserve 2048 visible
tokens. Increasing it requires a different protocol, not editing this baseline.

## Verification and later execution

Routine verification uses synthetic fixtures, fake providers and intercepted HTTP.
It covers all subject prompts, reference extraction/stop cases, target-answer
exclusion, version dispatch, immutable snapshots and offline release verification.
`plan --offline` constructs requests only; `run --offline` can still call paid APIs.

Any future live calibration needs its own explicit authorization and budget.
Before a full run, confirm access to the exact candidates, usage accounting,
complete paired technical outcomes and the agreed budget. Freeze settings before
looking at test correctness. Unparseable/wrong/refused outputs remain in the
comparison; do not optimize prompts or require 100% parsing success to match the
authors' method. Never selectively retry them. Report parsing, refusal and
truncation rates separately from accuracy.

The existing project publication policy still blocks an incomplete matrix or any
truncation. Cap-limited outputs are retained and scored, not excluded. If this
prevents publication, document the limitation; do not enlarge the cap, repair data
or silently rerun only failures. Publishing requires its own explicit step under
the [release guide](releases.md).

## Earlier proposals and results

This plan supersedes the v2 baseline and the format/data-repair gates proposed in
[PR #12](https://github.com/limit-115/llang-gap/pull/12). The experimental prompt and
nano pilot in [PR #16](https://github.com/limit-115/llang-gap/pull/16) are historical
work, not the primary comparison or a prerequisite for it. That branch, its audit,
configuration and immutable test release are preserved at
`8524ce0eb5bf20ae2b056d1b1400226c28f580f1`.

The earlier v1 parser was also different from the author's regex, so reverting v2
alone would not restore the protocol. Old v1/v2 scores keep their original meaning.
They are not recalculated with v3, relabelled or mixed into a v3 comparison.
No model requests, releases, website previews or scheduled evaluations are created
by preparing this plan.

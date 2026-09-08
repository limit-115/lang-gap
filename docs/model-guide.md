# Model guide and release history

The homepage is a model guide. Each API/model/effort configuration has one row and each selected benchmark
language has its own score. Model pages retain the underlying dataset, configuration,
release and paired-comparison results. Homepage text, navigation and the run builder
are independent of this presentation.

## Three separate identities

- A **run/release** records an experiment. Its original prompts, answers, scores and
  hashes stay immutable. A release still covers one dataset and protocol.
- A **suite** defines the meaning of an overview score: pinned test conditions,
  language inputs, task and family weights, repeat count and output cap. These are
  declared inputs, not global dataset or language defaults.
- A **guide snapshot** selects published releases and one explicit API/model/effort
  profile per row when `configurationRows: true`. Legacy plans without this flag retain
  one profile per model. It contains the resulting scores and their source references.
  New evidence creates a new snapshot; changing the suite or an existing model's
  profile requires a new suite ID. Adding a new model profile is allowed.

`packages/contracts/guide` owns the shared schemas. `packages/evaluation/guide`
calculates the index. The runner publishes and verifies snapshots. The website
loads their checksummed public aggregates and never opens SQLite, executes a model,
downloads raw responses or calculates scientific statistics.

## What the score means

For each dataset/language condition, let `a` be its published accuracy and `b` the
mean random-guess accuracy of its test questions (`mean(1 / optionCount)`). The
normalized task score is:

```text
taskScore = 100 × max(0, (a − b) / (1 − b))
familyScore = weighted mean of taskScore within that family
languageScore = weighted mean of familyScore across that language's families
```

This is a new, exploratory composite metric in **index points**, not a percentage
of correct answers or a measure of conversational fluency. The zero floor is an
explicit policy: performance at or below random guessing receives zero. Raw
accuracies remain available on the model and release pages. Normalization adjusts
the guessing baseline; it does not make dataset difficulty equal or estimate
general intelligence.

No raw questions are pooled across datasets. A large dataset does not gain weight
because it has more questions. Additional releases and repeated requests do not
increase a dataset's weight. Related datasets, including translation variants,
should belong to the same family so adding variants does not automatically make
that family dominate. Family membership and weights are reviewed suite choices.

The first suite explicitly selects the currently published human-translation
mmPISA condition. Its single dataset is identified as early evidence on model
pages. The initial Ling profile uses the published low-effort condition as an
explicit operational choice; this retrospective selection is not a preregistered
experiment or a claim that effort levels have equal compute across models.

## Selecting evidence

The guide plan lists eligible release IDs. For each model, task and language, the
builder selects **one** matching published observation. It requires the same:

- dataset identity, revision and complete manifest hash;
- protocol identity/hash and actual question/prompt input hash;
- output token cap, repeat count and selected API/model/effort profile;
- language, full test-question count, question-alignment hash and random baseline.

Among matching observations, the newest run creation time wins. Release creation
time and then release ID break ties. Republishing an old run cannot displace a
newer run; correcting a release of the same run can. Accuracy is never a selection
criterion. A newer incompatible run is preserved in history and does not replace
compatible evidence. Selecting different evidence requires a new guide snapshot.

An exact canonical owner/model ID groups the history of native and routed models
where the repository knows their identity. Different versions and quantizations
are not fuzzy-matched. Unknown native IDs get transport-qualified routes without
inventing a developer name. Grouping history does **not** pool provider results:
only the explicit selected profile contributes to the score. Provider aliases can
still drift; timestamps and original returned model IDs remain in release artifacts.

## Missing and incremental results

| Situation                                                              | Result                                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Configuration A has five languages, B has twenty-five                  | One row per configuration; absent scores are `—`, never zero.                         |
| A later run adds languages                                             | New languages are eligible without deleting earlier language results.                 |
| A new model or language is outside the current suite/profile selection | Its published evidence is available in history; no inferred overview score.           |
| A required task is missing                                             | The whole language score is withheld. We never average just the available tasks.      |
| One language has a different test basis                                | Models within its column remain comparable; a cross-language difference is withheld.  |
| Multiple releases repeat the same run or questions                     | Select one matching observation; do not add denominators or average release averages. |
| A newer result has another effort, cap, protocol or dataset revision   | Keep it in history; it does not silently alter the current score.                     |
| A model genuinely scores zero                                          | Display `0.0`, distinct from missing data.                                            |
| A bad release is withdrawn from consideration                          | Remove it from the next plan; preserve its files and old guide snapshots for audit.   |

Partial runs are not benchmark releases. For work performed in small batches,
resume the **same run** until its fixed matrix is complete, then publish it.
Independent overlapping subsets cannot be stitched together from aggregate
percentages: question/attempt-level reconciliation would be a separate reviewed
runner feature. This change does not relax the full-dataset publication gates or
publish synthetic/subset artifacts on the website.

Different languages may have different registered test bases. All models in a
given language column must meet that column's complete basis. Adding languages
does not average them into a global model score. Extending a suite requires a new
suite ID; existing values remain identical when their inputs and weights are
unchanged.

## Effort and language controls

The effort selector defaults to **All effort levels**. Each row displays its effort
and API provider; selecting one level filters configurations before pagination and
sorting. Search and effort filters work together, and Reset filters clears both.
Counts refer to configurations, not unique model names. Matching labels across
providers do not imply equal computing budgets. Score links retain the exact
API/model/effort selection on the model page.

The `multilingual-effort-v2` suite preserves the first suite's task inputs and weights
but lists every currently published effort as a separate profile. The original
low-only snapshot remains immutable. New plans should set `configurationRows: true`
and explicitly list each eligible API/model/effort profile. Unlisted configurations
remain visible with withheld scores; their effort is never borrowed from another row.

## Language controls and uncertainty

The table initially shows up to three available languages, in canonical tag order.
The searchable Languages menu can show any subset, including none. Hiding a sorted
column restores alphabetical model ordering; missing scores sort last in either
direction. Choosing languages does not change the recorded scores.

There is no default comparison pair. **Compare languages** reveals two selectors;
only an explicit pair adds one difference column. Hiding either participant clears
the comparison. Re-enabling the language does not restore it implicitly.

A difference is displayed only for complete scores with identical task/family
weights, normalized scales, protocol conditions and aligned question identities.
It is baseline minus candidate, in index points. It is descriptive, not a paired
significance test. **No composite confidence interval is manufactured from the
release intervals.** Model and release pages preserve the original per-dataset
paired gaps and their intervals. An interval containing zero remains inconclusive.

## Operator workflow

Normal `release stage` now adds a compact `evidence.json` sidecar. It records
fingerprints derived from the verified public prompts, question inputs and saved
configuration, including the run creation time. It contains no responses or keys.
The original manifest and aggregate bytes remain unchanged.

For an already staged historical release, first verify its downloaded public files
using its recorded checkout and dependencies. Then derive the sidecar in the new
checkout:

```sh
pnpm bench guide evidence /path/to/verified-public-release
```

This requires an exact match to the already staged manifest, verifies its file
hashes and derives metadata. It does not re-score historical answers. Existing
sidecars cannot be overwritten. Old releases lacking a sidecar remain readable
but cannot contribute a guide score.

Edit `results/guide-plan.json`: add eligible release IDs and model profiles. For a
new suite, use the relevant sidecars to pin task/language fingerprints; choose and
review the task families and weights. Keep API configuration selection independent
of observed accuracy. Then:

```sh
pnpm bench guide build results/guide-plan.json --id <new-guide-id>
pnpm bench guide verify <new-guide-id>
pnpm guide:check
```

The builder writes `results/guide/<id>/summary.json` and updates the separate
`results/guide/index.json`. Snapshot IDs are exclusive and source manifest/evidence
hashes are recorded. `guide:check` independently rebuilds every indexed snapshot
from its saved plan and public sources; CI runs it. It needs neither API keys nor
the private run database.

Commit the plan, new sidecars, snapshot and guide index through a PR. An ordinary
release stage only updates release history; publishing a guide snapshot is an
explicit step. `LLANG_GUIDE_ID` can pin a published snapshot for the site. An
unknown snapshot or changed source fails instead of substituting another score.
`LLANG_RELEASE_ID` no longer selects the homepage table.

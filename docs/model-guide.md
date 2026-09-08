# Published result summary

The homepage summarizes all published benchmark releases. Each transport/model/effort
configuration has one row; each benchmark language has a column. Dataset IDs and
languages come from the publication inventory, independently of website locales.
There is no fixed test suite, allowed-dataset list, output cap or repeat count for
admission to the summary.

## Calculation: mean-dataset-accuracy-v1

For each transport/model/effort/language and dataset ID, select one published
observation. The newest run creation time wins; release creation time and release
ID break ties. When a historical release has no evidence sidecar with its run time,
use release creation time. Republished evidence with a known older run time cannot
replace a newer run. Selection never depends on accuracy.

Average the selected dataset accuracies with equal weight:

```text
mean accuracy (%) = 100 × sum(selected dataset accuracies) / selected dataset count
```

80% on a five-question dataset and 90% on a 500-question dataset produce 85%.
Question denominators are never pooled across datasets. More questions, repeats,
protocol variants, revisions or published runs do not increase a dataset's weight.
The selected release's accuracy already averages its prespecified repeats.
Different dataset IDs, including translation variants, remain distinct contributions.
Different transports, models and efforts remain separate rows.

Only available datasets contribute. Missing another dataset never hides an available
score. A dash means no published observation for that configuration and language;
a measured zero remains zero. Each cell links to the model's source results, where
the contributing datasets can be inspected. Different cells can cover different datasets and difficulties;
the number is a descriptive summary, not a controlled ranking or a fluency measure.
There is no random-guess correction, normalization floor or family weighting.

Token caps (including omitted caps), repeat counts, dataset revisions, protocol
versions and prompt identities are source metadata, not summary eligibility filters.
Selecting the newest result can therefore change a cell's experimental conditions.
Original releases retain every setting, score and checksum for inspection.

## Language controls

The table initially shows English, Russian, Kazakh, Spanish and Chinese when
available. If none are available, it shows the first three available languages.
These are display preferences only, independent of experiment inputs. The searchable
Languages menu can show any subset, including none. Select all shows every available
language, including languages hidden by the current search. Hiding a sorted column
restores alphabetical model ordering; missing scores sort last. Choosing languages
does not change the recorded scores.

## Language differences

English remains an optional display reference, not an experiment default. Show
language mean accuracy minus English mean accuracy in percentage points only when
the two selected observations cover the same dataset IDs, revisions, manifest hashes,
protocol identities and aligned question sets. This check controls the difference
annotation only; it never suppresses an accuracy. Missing alignment evidence withholds
the annotation. Caps and repeat counts do not restrict descriptive summary differences.
No composite confidence interval is inferred. The runner's explicit paired analyses
retain their own stricter compatibility checks and unchanged statistical method.

## Publication and audit

The website reads checksummed public aggregates and summary snapshots. It never
executes models, reads SQLite, or computes benchmark statistics. `results/index.json`
is the inventory. `results/guide-plan.json` uses schema v2:

```json
{
  "schemaVersion": 2,
  "aggregation": "mean-dataset-accuracy-v1",
  "releases": []
}
```

`releases` is resolved automatically from the published index, not maintained as a
second whitelist. No task list, profile list, weights or runtime settings are needed.
The aggregation identity pins the new methodology. Changing the formula or selection
rule requires a new aggregation identity and a new immutable summary snapshot.

`bench release stage` synchronizes the summary after staging a verified release.
To recover from an interrupted synchronization or migrate an existing inventory:

```sh
pnpm bench guide sync
pnpm guide:check
```

Commit the resolved plan, summary snapshot and guide index together. Synchronization
is idempotent for the same inputs. `guide:check` reproduces indexed snapshots and
checks publication freshness. No model API calls are involved.

The benchmark publication gates are unchanged: complete non-synthetic runs,
reproducible scores, valid provenance and checksums, no truncated responses. Missing
prices are allowed. Optional `evidence.json` sidecars provide run dates and alignment
fingerprints; their absence does not discard a published accuracy. Corrupt evidence
or changed public artifacts still fail validation.

`LLANG_GUIDE_ID` may explicitly select an older indexed snapshot. Unknown snapshots
and changed sources fail rather than silently substituting different data.

## Historical normalized guides

Schema-v1 plans and their immutable snapshots retain the former fixed-suite method:
`100 × max(0, (accuracy − randomBaseline) / (1 − randomBaseline))`, followed by
explicit task/family weighting and complete-suite coverage checks. They continue to
verify with their saved plans, including pinned caps and repeats. Their score values
and source releases are not rewritten by the schema-v2 summary migration.

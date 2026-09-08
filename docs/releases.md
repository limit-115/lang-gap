# Release artifacts and website integration

## Local commands

```sh
pnpm bench score <run-id>
# Optional language comparisons can be chosen after execution.
pnpm bench release build <run-id> --id <release-id> --compare ja:de
pnpm bench release verify .llang-gap/releases/<release-id>
```

`--test` explicitly permits synthetic or subset runs. Test artifacts are labelled
`kind: "test"` and cannot be staged for the public website. A benchmark release
requires complete test sets, all specified model/effort/language/repeat conditions,
no truncation and a clean committed implementation at run creation. The release
builder verifies every answer, cost and aggregate with the recorded protocol before
it writes artifacts. In author-api-v3, cap-limited text is scored by the author
regex in the journal, but truncation still blocks publication of the entire
comparison. This is a project publication policy, not the harness scoring rule.
No question is removed from the denominator.

Release directories are immutable by convention and creation is exclusive: an
existing release ID fails instead of being overwritten. Files are constructed in
a temporary directory, verified, then atomically renamed. To correct a release,
create a new ID and describe the correction in the version-control change.

Historical v1/v2 artifacts remain immutable and keep their original scoring. Do
not run the new parser over old outputs or edit their protocol IDs. Verification
requires their recorded source and runtime dependencies; v2's original code stays
at PR #16's revision. See [protocol history](protocols/mmluprox.md#historical-v1v2-and-offline-evidence).

New experiments, run snapshots and release manifests use schema v3. Aggregates
contain `scores: [{ language, n, accuracy, repeatAccuracy }]` and
`comparisons: [{ baseline, language, n, gapPp, gapCi95 }]` for each transport/model/
effort. The release preserves the resolved experiment's ordered `languages`. Its
`comparisons` come from the independently recorded `analysis.json` selection,
using `--compare` at release build or the optional run preset. The original
`resolved.json` remains byte-for-byte unchanged. CSV is long-form: `metric=accuracy` rows name a language;
`metric=comparison` rows name both language and baseline. It has no per-language
column names. Empty comparison lists are valid, including single-language releases.

Schema-v1/v2 artifacts must be resumed and verified with their recorded checkout;
never rename or add fields inside saved artifacts. No public releases were indexed
when schema v3 was introduced. Existing local state remains untouched. New runs
using old protocol IDs retain the pinned prompt/parser inputs, but have a new
snapshot identity and must not overwrite or silently pool historical artifacts.

## Files

| File                    | Contents                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `manifest.json`         | ID, kind, date, provenance, aggregate rows and SHA-256 of every other file                         |
| `resolved.json`         | Exact resolved experiment, protocol, dataset manifest, implementation and SDK versions             |
| `identity.json`         | Hash of the resolved snapshot                                                                      |
| `dataset-manifest.json` | Original repository, revision, source hashes and localized instructions                            |
| `dataset.jsonl`         | Normalized selected-language test and validation input snapshot                                    |
| `items.jsonl`           | One selected completed response per job, prompt, visible output, score, usage and latency          |
| `analysis.json`         | Post-run language comparison selection; defaults to the run preset                                 |
| `aggregate.json`        | Model/effort rows, language scores and explicitly named paired comparisons                         |
| `aggregate.csv`         | Long-form language scores and named comparison intervals                                           |
| `attempts.jsonl`        | Every technical attempt, timestamps, status, known/uncertain charge and request ID                 |
| `execution.json`        | Overall charged/reserved amount (`null` when unknown), completion counts and operational event log |
| `ATTRIBUTION.md`        | Selected dataset attribution and applicable protocol license notices                               |

Raw SDK response bodies remain in the private SQLite journal. Public results
include visible final text, not API thinking blocks/signatures, keys or HTTP
headers. Hashes detect corruption; they are not cryptographic proof that a hosted
model produced the response. Git history and open artifacts supply the audit trail.

`release verify <directory>` works without the original SQLite file or API keys.
It requires this repository's recorded protocol version. It validates the complete
file set and hashes, matches prompts and labels to the supplied input snapshot,
checks the full job matrix and analysis selection, then independently recomputes
scores and bootstrap intervals. Historical schema-v3 assets without `analysis.json`
use their original snapshot comparisons. Keep the recorded source revision for future rechecks.

## Staging for the website

Upload the verified artifact files to a durable HTTPS location, such as assets
under a GitHub Release. Uploading is a separate operator action; the CLI never
implicitly publishes to GitHub or deploys a website.

```sh
pnpm bench release stage .llang-gap/releases/<release-id> \
  --assets-url https://github.com/limit-115/llang-gap/releases/download/<release-id>
```

This adds the small `manifest.json`, `aggregate.json` and `assets.json` files under
`results/<release-id>/` and updates `results/index.json`. `assets.json` has shape
`{"baseUrl": "https://…"}`. The large dataset and response exports stay out of Git.
Staging checks the local artifact; it does not assert remote availability. Confirm
uploaded asset hashes before merging/deploying the index change.

Staged `manifest.json` and `aggregate.json` are exact copies of the verified
release files and are excluded from formatting. Preserve their bytes: formatting
the aggregate would invalidate its manifest hash. The index and asset URL files
remain subject to normal repository formatting.

The [model guide](model-guide.md) combines eligible observations through a separate
versioned suite and snapshot. `release stage` also derives a small `evidence.json`
sidecar for that workflow; it does not modify the immutable release manifest or
aggregate and does not automatically publish a new guide snapshot.

The website should:

1. Resolve the homepage guide from `LLANG_GUIDE_ID` or `results/guide/index.json`.
   Release history reads every ID in `results/index.json`; adding a release never
   replaces the whole model guide. Fail for missing or invalid selected artifacts.
2. Validate public manifests with `releaseManifestSchema` from
   `@llang-gap/contracts`; accept only `kind: "benchmark"`. Check the aggregate file
   against its manifest hash before rendering. Do not import the runner, transport
   SDKs, dataset loader or scientific scoring code.
3. Render the same numerical aggregates at `/en/` and `/ru/`, localizing only labels,
   number/date formatting and explanatory text. Default ordering should not imply
   a winner. Derive columns, language names,
   question counts and named gaps from the release. Display its dataset, protocol,
   date and repeats on release/model detail pages; keep those fields out of the
   homepage overview. Never substitute a global dataset or question count.
4. Generate history and permanent release detail pages from the index. Download
   URLs are `${baseUrl}/${filename}`, including `manifest.json`. The manifest
   provides the checksums; avoid embedding the full response archive in bundles.
5. Publish per-repeat scores and distinguish completion-only costs from the total
   execution ledger. Missing costs are unknown, never zero. Intervals containing
   zero require a neutral interpretation.

The code/API surface for the redesign agent is `Aggregate`, `ReleaseManifest`,
`aggregateSchema` and `releaseManifestSchema`, exported from the contracts package.
No SQLite access or live API requests are needed by the site.

### Citing a published release

On a release page, **Cite this release** lets readers copy the citation with its
permanent release URL or copy just the link. Expand **BibTeX** to copy the entry
or download a `.bib` file for a reference manager. Citations identify the dataset,
release ID, creation date, and protocol; cite the specific release used in your
analysis. If clipboard access is unavailable, select and copy the displayed text.

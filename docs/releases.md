# Release artifacts and website integration

## Local commands

```sh
pnpm bench score <run-id>
pnpm bench release build <run-id> --id <release-id>
pnpm bench release verify .llang-gap/releases/<release-id>
```

`--test` explicitly permits synthetic or subset runs. Test artifacts are labelled
`kind: "test"` and cannot be staged for the public website. A benchmark release
requires complete test sets, all specified model/effort/language/repeat conditions,
no truncation and a clean committed implementation at run creation. The release
builder recomputes every answer, cost and aggregate before it writes artifacts.

Release directories are immutable by convention and creation is exclusive: an
existing release ID fails instead of being overwritten. Files are constructed in
a temporary directory, verified, then atomically renamed. To correct a release,
create a new ID and describe the correction in the version-control change.

## Files

| File                    | Contents                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `manifest.json`         | ID, kind, date, provenance, aggregate rows and SHA-256 of every other file                |
| `resolved.json`         | Exact resolved experiment, protocol, dataset manifest, implementation and SDK versions    |
| `identity.json`         | Hash of the resolved snapshot                                                             |
| `dataset-manifest.json` | Original repository, revision and Parquet hashes                                          |
| `dataset.jsonl`         | Normalized EN/RU test and validation input snapshot                                       |
| `items.jsonl`           | One selected completed response per job, prompt, visible output, score, usage and latency |
| `aggregate.json`        | Model/effort rows, EN/RU accuracy, gap in pp, paired 95% interval, repeat accuracies      |
| `aggregate.csv`         | Portable table of scores and paired intervals                                             |
| `attempts.jsonl`        | Every technical attempt, timestamps, status, known/uncertain charge and request ID        |
| `execution.json`        | Overall charged/reserved amount, completion counts and operational event log              |
| `ATTRIBUTION.md`        | Dataset and harness source attribution and upstream license notice                        |

Raw SDK response bodies remain in the private SQLite journal. Public results
include visible final text, not provider thinking blocks/signatures, keys or HTTP
headers. Hashes detect corruption; they are not cryptographic proof that a hosted
model produced the response. Git history and open artifacts supply the audit trail.

`release verify <directory>` works without the original SQLite file or API keys.
It requires this repository's recorded protocol version. It validates the complete
file set and hashes, matches prompts and labels to the supplied input snapshot,
checks the full job matrix, then independently recomputes scores and bootstrap
intervals. Keep the recorded source revision for future rechecks.

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

The website should:

1. Resolve a fixed release ID from `LLANG_RELEASE_ID` or `results/index.json.latest`
   at build time. Fail for missing or invalid releases, rather than silently using
   an unrelated result. An empty index renders a truthful unpublished state.
2. Validate public manifests with `releaseManifestSchema` from
   `@llang-gap/contracts`; accept only `kind: "benchmark"`. Check the aggregate file
   against its manifest hash before rendering. Do not import the runner, provider
   SDKs, dataset loader or scientific scoring code.
3. Render the same numerical aggregates at `/en/` and `/ru/`, localizing only labels,
   number/date formatting and explanatory text. Default ordering should not imply
   a winner. Display EN, RU, signed `gapPp`, `gapCi95`, `n`, `repeats`, protocol and date.
4. Generate history and permanent release detail pages from the index. Download
   URLs are `${baseUrl}/${filename}`, including `manifest.json`. The manifest
   provides the checksums; avoid embedding the full response archive in bundles.
5. Publish per-repeat scores and distinguish completion-only costs from the total
   execution ledger. Missing costs are unknown, never zero. Intervals containing
   zero require a neutral interpretation.

The code/API surface for the redesign agent is `Aggregate`, `ReleaseManifest`,
`aggregateSchema` and `releaseManifestSchema`, exported from the contracts package.
No SQLite access or live API requests are needed by the site.

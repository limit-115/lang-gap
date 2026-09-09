# Release workflow

A public benchmark needs complete non-synthetic test sets and conditions, no truncation, and a clean
committed implementation at run creation. Corrections require a new release ID; preserve old bytes.

```sh
pnpm bench release build <run-id> --id <release-id> --compare ja:de
pnpm bench release verify .llang-gap/releases/<release-id>
```

Omit `--compare` for the saved preset (possibly empty). Analysis does not mutate execution inputs.
`--test` permits synthetic/subset artifacts, which cannot be staged publicly.
Verification recomputes scores and checks provenance without SQLite/API keys; retain the recorded checkout.
Upload verified artifacts to durable HTTPS storage as a separate operator action, then stage:

```sh
pnpm bench release stage .llang-gap/releases/<release-id> --assets-url <https-base-url>
pnpm guide:check
```

Confirm every remote download's bytes and checksums before merging the index change.
Commit the staged files, results index, resolved guide plan, summary snapshot and guide index together.
If summary synchronization fails after staging, fix the cause and run `pnpm bench guide sync`.
Never reformat staged manifest/aggregate bytes: their hashes are part of the published identity.
Large input/response exports stay outside Git; raw SDK bodies stay private. Hashes detect corruption,
but do not prove a hosted model produced a response. Preserve source attribution with downloads.
The website reads verified public aggregates only; runner state and model execution stay outside it.
See [summary interpretation](model-guide.md) and [public URL checks](search-discovery.md).

## Submitter attribution

When staging a release, record its submitter in [results/submissions.json](../results/submissions.json),
keyed by the published release ID. Each entry contains the contributor's confirmed `fullName`
and `githubUsername`. The report board shows the full name and links to that GitHub profile.
Confirm attribution with the contributor; a release publisher, commit author, or automation account
is not necessarily the person who submitted the experiment.

This optional, versioned publication metadata is kept outside immutable release directories.
A missing entry is shown as “Submitter not recorded”; the website does not infer a person or call
GitHub to fill it in. Attribution corrections update this file without rewriting or rehashing
benchmark manifests, aggregates, or downloads.

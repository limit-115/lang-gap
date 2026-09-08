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

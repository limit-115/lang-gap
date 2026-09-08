# Dataset manifests and language inputs

Register a dataset with `datasets/<id>/manifest.json` and `protocols.json`. `--dataset <id>` resolves that
file; the manifest's `id` must match. IDs are safe path components, not directories
or URLs. The selected experiment or CLI flags supply its language tags. There is
no global dataset, language list, question count, or required comparison pair.

## Available protocols

Each dataset also has `datasets/<id>/protocols.json`:

```json
{
  "recommendedProtocol": "multiple-choice-v1",
  "protocols": ["multiple-choice-v1"]
}
```

This explicitly lists the methods offered for that dataset. The recommendation
must be listed, IDs must be unique, and every listed adapter must support at least
one test language in the manifest. The adapter still checks its scientific
requirements; listing a protocol cannot enable unsupported languages or inputs.
Multiple datasets can reuse the same protocol implementation.

The website selects the recommendation when choosing a dataset and offers only
its declared protocols. `pnpm bench dataset list` shows the same catalog without
fetching sources or calling models. CLI runs may omit `--protocol` to use the
recommendation; an explicit protocol overrides it. Switching datasets with
`--dataset` resets an inherited YAML protocol to the new dataset's recommendation
unless `--protocol` is supplied too. Selected languages remain explicit.

Recommendations are setup metadata, separate from the pinned data manifest.
The resolved experiment records the exact protocol ID; snapshots retain the
protocol object and hash. Changing a recommendation does not alter saved runs,
resume behavior or releases. Existing prompt labels remain pinned in manifests;
this registration does not change their ownership or prompt bytes.

## Normalized multiple-choice data

Schema-v2 manifests accept `format: "normalized-jsonl"` for any dataset represented
by the shared `Question` contract. Each line contains:

```json
{
  "id": "arithmetic:1",
  "sourceId": "source-1",
  "language": "de",
  "split": "test",
  "category": "arithmetic",
  "question": "Wie viel ist 1 + 1?",
  "options": ["2", "3"],
  "answer": "A",
  "cot": ""
}
```

The question ID is stable within a language. IDs used in explicit comparisons
identify the same question across languages. `sourceId` preserves the upstream
string or numeric identity. Splits are `test` or `validation`; option labels are
A–J with 2–10 options. `answer` must be in range. Test answers and solutions remain
scoring data and never enter prompts. A dataset with a different task structure
requires a reviewed normalization/protocol adapter, not fabricated MCQ fields.

The following is the shape of a manifest, with placeholder revision/hash values
that must be replaced by real pins before use:

```json
{
  "schemaVersion": 2,
  "id": "my-dataset",
  "repository": "organization/dataset-repository",
  "revision": "0000000000000000000000000000000000000000",
  "normalizerVersion": 1,
  "format": "normalized-jsonl",
  "license": "Actual dataset license and attribution",
  "source": "https://huggingface.co/datasets/organization/dataset-repository",
  "prompts": {
    "de": {
      "instruction": "Antworte nur mit dem Buchstaben der richtigen Option.",
      "question": "Frage:",
      "options": "Optionen:"
    },
    "fr": {
      "instruction": "Répondez uniquement par la lettre de la bonne option.",
      "question": "Question :",
      "options": "Options :"
    }
  },
  "files": [
    {
      "path": "de/test.jsonl",
      "language": "de",
      "split": "test",
      "rows": 100,
      "sha256": "0000000000000000000000000000000000000000000000000000000000000000"
    },
    {
      "path": "fr/test.jsonl",
      "language": "fr",
      "split": "test",
      "rows": 100,
      "sha256": "0000000000000000000000000000000000000000000000000000000000000000"
    }
  ]
}
```

Sources are downloaded from the declared Hugging Face repository at the immutable
revision. Files may be sharded and have arbitrary safe relative paths. Each file's
checksum, row count, language and split are checked. Duplicate paths and question
identities are rejected. Row counts come from the manifest, not the benchmark.
`multiple-choice-v1` requires reviewed localized prompt labels for every selected
language. Manifest changes, including instruction text, enter the run identity.

To start a new experiment, copy an appropriate fake/live model configuration,
set `schemaVersion: 3`, `dataset: my-dataset`, `protocol: multiple-choice-v1`,
`languages: [de, fr]`, and `comparisons: [{ baseline: fr, language: de }]`.
Use `comparisons: []` for independent scores. Remove the example's `questionLimit`
for a full run. Models, efforts, output limits, repeats, execution settings, seed
and dated prices stay explicit. Live runs still require an agreed budget.

```sh
pnpm bench dataset prepare experiments/custom.yaml --dataset my-dataset --language de
pnpm bench plan experiments/custom.yaml --dataset my-dataset --languages de fr --compare fr:de
```

A selected language must have a declared test split. Selecting only one language
does not require downloading any other language, and can produce a full release.
Comparisons require identical complete test identities and answer structure; the
runner never silently intersects mismatched language sets. Independent language
scores can use unequal sets. A question limit chooses a seeded subset per language;
compared languages share the same subset ordering.

## Pinned Parquet adapter

`format: "mmluprox-parquet"` normalizes the MMLU-ProX source layout (source IDs,
`option_0`…`option_9`, answer index, category and CoT). Existing schema-v1 manifests
use that format implicitly and remain unchanged. Their file counts, split sizes
and available languages are manifest data. The author prompt/parser adapter's
reviewed language coverage is documented in [its protocol](protocols/mmluprox.md).
A language tag alone does not create missing upstream prompts or translations.

## Shared source files (schema v3)

Schema-v3 dataset manifests separate physical source files from normalized
language/split partitions. A CSV or JSONL file can contain several languages;
its source row count need not equal one language's test count. These manifest
versions are independent of experiment and release schema versions.

The common source loader owns pinned downloads, checksums, caching and partition
counts. Format adapters in `packages/datasets/src/adapters` own decoding and
normalization. Runner, scoring and release validation consume shared `Question`
rows and declared partitions without dataset-specific branches.

Compared with schema v2, v3 declares:

- `hosting`: `huggingface` or `github`. Both resolve `repository`, immutable
  `revision` and safe relative file paths; arbitrary download URLs are not accepted.
- `adapter`: `{ "format": "normalized-jsonl" }`,
  `{ "format": "mmluprox-parquet" }`, or
  `{ "format": "mmpisa-csv", "translation": "human" }` (also `machine`).
  Adapter settings enter the full manifest identity; unknown settings fail.
- `files`: physical sources with `path`, `sha256`, raw `rows`, and
  `partitions: [{ language, split, rows }]` describing their normalized output.
  Each language/split occurs once per file; shards may contribute to the same
  partition across files. Paths remain unique. Parquet's upstream format still
  requires one language/split per file.

`prompts` and `normalizerVersion` retain their existing meaning. New formats need
a shared schema alternative, a decoder, synthetic regression coverage and
documented methodology. A new dataset in an existing format needs a pinned
manifest and protocol registration, not a runner change. Schema-v1/v2 manifests remain accepted without
rewriting or injecting defaults into their saved objects.

Only files contributing to selected languages are fetched. A shared file is
decoded once per preparation, checked against its raw count and all declared
output partitions, then filtered to the requested languages. Selecting a language
does not remove other languages from an upstream shared download.

## mmPISA

`mmpisa` and `mmpisa-machine` register the human and machine translation conditions
of mmPISA as distinct datasets, with 43 languages and 25 test questions per
language at the pinned revision. They use `multiple-choice-v1` and preserve
question context and composite answer choices. See the
[mmPISA guide](datasets/mmpisa.md) for source pins, normalization, language tags,
attribution and runnable examples.

## Cache and release validation

Source files live under `.llang-gap/datasets/<id>/<revision>/normalizer-<version>/`.
Normalization output is keyed by the selected language set; runs snapshot the
exact returned rows and full original manifest. Resume reads that immutable
snapshot. Release validation checks declared per-language split totals and every
selected job. A partial dataset cannot pass as a full release. Original pinned
files, local journals and immutable historical releases must not be edited to
accommodate new languages or schema versions.

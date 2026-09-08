# mmPISA

Llang Gap registers two separate conditions from
[mmPISA-bench](https://github.com/ysapenov/mmPISA-bench/tree/22b1caa65980ca1fa295acc31ee5e35200e0c8c0):

| Dataset ID       | Source condition                 | Manifest                                                     |
| ---------------- | -------------------------------- | ------------------------------------------------------------ |
| `mmpisa`         | Official human translations      | [Pinned inputs](../../datasets/mmpisa/manifest.json)         |
| `mmpisa-machine` | Machine translation counterparts | [Pinned inputs](../../datasets/mmpisa-machine/manifest.json) |

Both conditions declare 43 languages, each with 25 test questions: 11 Math and
14 Reading. These counts belong to this revision. There is no validation split.
Translation variants have different dataset identities; scores and cross-run
comparisons never silently pool them. The current comparison command does not
estimate human-versus-machine translation gaps across these dataset IDs.

## Run

```sh
# Download the pinned CSV and plan a free, four-question-per-language smoke test.
pnpm bench dataset prepare experiments/mmpisa-smoke.yaml
pnpm bench plan experiments/mmpisa-smoke.yaml --offline
pnpm bench run experiments/mmpisa-smoke.yaml --offline

# Select all questions in just one language, without an implicit comparison.
pnpm bench run experiments/mmpisa-smoke.yaml --language kk --all-questions --offline

# The other translation condition is an explicit dataset selection.
pnpm bench plan experiments/mmpisa-smoke.yaml --dataset mmpisa-machine --languages de fr --all-questions --compare fr:de
```

The example uses only the fake transport. Its scores are synthetic and cannot be
published as benchmark results. To evaluate a live model, explicitly select its
transport, model, efforts, token policy and any dated prices/budget following the
[runner guide](../runner.md). `--offline` controls dataset downloads only.

Available language tags:
`sq ar az eu nb bs bg ca zh hr cs da nl en et fi fr gl ka de el he hu is id it ja kk ko lv lt ms nn pl pt ru sr sk sl es sv th tr`.
These tags select upstream versions; they do not claim additional regional or
script coverage. In particular, Bokmål (`nb`) and Nynorsk (`nn`) remain distinct.

## Source and normalization v1

The manifests pin GitHub commit `22b1caa65980ca1fa295acc31ee5e35200e0c8c0` and
`mmPISA-bench.csv` SHA-256
`33b3cee68b76390a3871d3eb4bd27d77c824b3cd6642b4fcb70b6dcca4371680`.
The physical CSV contains 2,150 rows covering both translation conditions and
all languages. Preparing even one language downloads and validates that shared
file; only the selected condition and languages enter the normalized snapshot
and model jobs. No source export is vendored into this repository.

The `mmpisa-csv` adapter:

- Parses quoted, multiline CSV cells and the JSON-encoded options with strict
  column and row validation. Malformed data fails; rows are never skipped.
- Selects the translation condition from the upstream `language` name's
  ` Machine` suffix, checking the complete name/code combination against the
  pinned mapping. Upstream codes are not canonical language tags: for example
  `nno-NOR no` maps to `nn`, and `heb-ISR iw` maps to `he`. English and French
  machine rows reuse the human version's codes, so codes alone cannot select a
  condition.
- Preserves `qid` as both normalized ID and source ID, plus the upstream category.
  The question text is `context + "\n\n" + question`, retaining both fields exactly.
- Removes the existing sequential `A) `… labels from string options so the
  protocol labels each option once. An option such as `{"A":["yes","no"]}`
  becomes the compact JSON text `["yes","no"]`: one multiple-choice option,
  preserving component boundaries and order. It is never expanded into new
  questions or scored component by component.
- Preserves `gold` for scoring and retains non-`nan` rationale in `cot`.
  Neither field enters the prompt. Difficulty and source descriptions remain
  available in the pinned CSV; they are not prompt fields or scoring dimensions.

The selected language partitions must match their declared counts. Explicit
comparisons additionally require complete aligned question identities, categories,
gold labels and option counts. These checks do not establish translation fidelity.

## Evaluation condition and attribution

Use the existing [multiple-choice-v1 protocol](../protocol.md#multiple-choice-v1):
zero-shot, one localized instruction and one uppercase option letter as the entire
answer. The two manifests pin identical Llang Gap-authored instruction/label text
for each language; these are not upstream author prompt assets or independently
certified translations. No runtime translation or English fallback is used.
Changes to these inputs create a different run identity.

This is a Llang Gap evaluation condition, not a reproduction of the paper's
model results or prompting setup. MMLU-ProX protocols, hashes and manifests are
unchanged and cannot be selected for mmPISA. Historical runs still require their
recorded implementation and dependency versions.

Cite Yerzhan Sapenov and Jaromir Savelka (2026),
[mmPISA-bench: Do LLMs Reason Equally Well Across 43 Languages?](https://arxiv.org/abs/2606.07069).
The source derives from OECD PISA 2022 Mathematics and PISA 2018 Reading.
Upstream declares no separate dataset license and requires compliance with the
OECD terms governing the original content. The manifests preserve that statement;
the repository's MIT license does not relicense the assessment material.

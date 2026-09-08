# mmPISA

`mmpisa` and `mmpisa-machine` are distinct human/machine translation datasets, not interchangeable runs.
[Manifests](../../datasets) pin their shared source CSV, revision, hashes and language partitions.
A single-language preparation still downloads the shared CSV; only selected rows become model jobs.
Upstream language codes alone cannot identify translation conditions (English/French reuse codes).
Bokmål (`nb`) and Nynorsk (`nn`) remain distinct; tags do not imply extra regional/script coverage.

Context is retained before the question. Composite choices remain one ordered option, not new questions.
Gold answers and rationale remain scoring data, never target prompt content.
The zero-shot [multiple-choice protocol](../protocol.md#multiple-choice-v1) uses Llang Gap-authored labels,
not independently certified translations or the paper's prompting setup. Paper-score reproduction is not claimed.

Cite Sapenov and Savelka, [mmPISA-bench (2026)](https://arxiv.org/abs/2606.07069).
Upstream derives from OECD PISA 2022 Mathematics and 2018 Reading and declares no separate dataset license;
its OECD terms still apply. Repository MIT licensing does not relicense assessment material.

# Adding datasets

Register pinned sources in `datasets/<id>/manifest.json` and methods in `protocols.json`.
Use [existing manifests](../datasets) and [shared schemas](../packages/contracts/src/index.ts) as examples.

Pins cover revision, checksums, counts and localized prompts; changing them changes run identity.
Language tags alone do not supply missing translations. Never fall back to English or translate at runtime.
Source IDs must align across compared languages; independent scores need not share question sets.
Alignment of IDs/options/gold labels does not establish semantic translation fidelity.
Shared source files can contain unselected languages: selection limits jobs, not necessarily downloads.
Do not fix a checksum mismatch by changing its expected hash; inspect/remove the corrupt cache explicitly.
Keep source licensing and attribution distinct from this repository's MIT code license.
See [mmPISA](datasets/mmpisa.md) and [MMLU-ProX](protocols/mmluprox.md) before changing normalization.

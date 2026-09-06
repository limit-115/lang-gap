# MMLU-ProX Lite

Source: [li-lab/MMLU-ProX-Lite](https://huggingface.co/datasets/li-lab/MMLU-ProX-Lite).
Pinned revision: `e82aafb9460529687d3c7e51b401d8dd1dd309dd`.

The [source dataset card](https://huggingface.co/datasets/li-lab/MMLU-ProX-Lite/blob/e82aafb9460529687d3c7e51b401d8dd1dd309dd/README.md)
states MIT License. This multilingual dataset derives from MMLU-Pro and contains
question text, choices, gold labels and worked CoT examples. Preserve attribution
to MMLU-ProX and the underlying materials when redistributing snapshots.

Only the manifest and this attribution are tracked here. English and Russian each
contain 588 test and 70 validation rows. `bench dataset prepare` downloads the four
pinned Parquet files into `.llang-gap/datasets/`, verifies SHA-256, normalizes the
rows and checks alignment. No data is fetched from a mutable `main` revision.

Dataset and UI localization are separate concerns: translated benchmark prompts
belong to the pinned evaluation protocol; next-intl dictionaries belong to the site.

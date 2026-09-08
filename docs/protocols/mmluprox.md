# MMLU-ProX protocol limitations

Author-v3 pins five subject validation examples in source order, author prompt text, first-match regex
and a numeric 2048-token cap. Exact definitions live in [protocol code](../../packages/evaluation/src/protocols)
and [vendored reference](../../packages/evaluation/reference); dataset pins live in [the manifest](../../datasets/mmlu-prox-lite/manifest.json).
The [authors' instructions](https://github.com/weihao1115/MMLU-ProX/blob/e3f49f78074502422a5c9eb0306ff62c4c99d76d/README.md)
use vLLM text completion and do not pin the harness commit. Our pinned reference is not proof of paper parity.
API chat framing, tokenizers, sampling and hidden reasoning differ; 2048 includes reasoning, not just visible text.
Native effort labels do not guarantee equal compute. Local stop clipping can incur extra generation cost.
Only visible text is scored. Do not add bare-letter fallbacks or repair the author's extraction rule.
Translation/key concerns are limitations of pinned inputs, not permission to filter or correct test questions.
The flexible protocol reuses author prompts/parser but allows different/null caps: it is a different condition.

Historical v1/v2 outputs retain their parsers. V2 code and audit remain at commit
`8524ce0eb5bf20ae2b056d1b1400226c28f580f1`; use that checkout and lockfile for verification.
The initial [experiment](../../experiments/mvp.yaml) is one configuration, not benchmark-wide defaults
or authorization to spend money. Freeze settings before inspecting correctness; never tune on failures.

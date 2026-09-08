"""Regenerate synthetic parity evidence from a local pinned harness source tree.

Usage: python3 scripts/generate-harness-fixtures.py /path/to/lm-evaluation-harness
No imports of model backends, dataset downloads, credentials or network requests.
AST selection executes the original method bodies, removing registration decorators
and unrelated imports only. Keep upstream's MIT notice in evaluation/reference/.
"""

from __future__ import annotations

import ast
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from functools import partial
from pathlib import Path
from random import Random
from types import SimpleNamespace
from typing import cast

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = Path(sys.argv[1])
REFERENCE = ROOT / "packages/evaluation/reference"
COMMIT = "b954108c9baaaa934b4ad842033b31a97ee30816"
HASHES = json.loads((REFERENCE / "harness-files.json").read_text())
for name, digest in HASHES.items():
    assert hashlib.sha256((UPSTREAM / name).read_bytes()).hexdigest() == digest, name


def definitions(path, names, namespace, owner=None):
    """Load named original definitions without importing the full harness runtime."""
    tree = ast.parse((UPSTREAM / path).read_text())
    nodes = tree.body
    if owner:
        nodes = next(
            n for n in nodes if isinstance(n, ast.ClassDef) and n.name == owner
        ).body
    selected = [
        n
        for n in nodes
        if isinstance(n, (ast.ClassDef, ast.FunctionDef)) and n.name in names
    ]
    assert len(selected) == len(names)
    for node in selected:
        # Only module registration / positional deprecation wrappers are omitted.
        if node.name != "Message":
            node.decorator_list = []
    module = ast.Module(
        body=[
            ast.ImportFrom(
                module="__future__", names=[ast.alias(name="annotations")], level=0
            ),
            *selected,
        ],
        type_ignores=[],
    )
    exec(compile(ast.fix_missing_locations(module), path, "exec"), namespace)


ns = {
    "__name__": __name__,
    "dataclass": dataclass,
    "partial": partial,
    "cast": cast,
    "Random": Random,
    "re": re,
    "Filter": object,
}
definitions(
    "lm_eval/api/utils.py",
    ["Message", "maybe_delimit", "requires_delimiter", "multiturn_to_singleturn"],
    ns,
)
definitions("lm_eval/api/samplers.py", ["ContextSampler", "FirstNSampler"], ns)
definitions("lm_eval/filters/extraction.py", ["RegexFilter"], ns)
definitions("lm_eval/filters/selection.py", ["TakeFirstFilter"], ns)
definitions("lm_eval/models/utils.py", ["postprocess_generated_text"], ns)
definitions(
    "lm_eval/api/task.py", ["fewshot_context", "build_qa_turn"], ns, "ConfigurableTask"
)

# Verify configuration inheritance instead of supplying different delimiters.
config_tree = ast.parse((UPSTREAM / "lm_eval/config/task.py").read_text())
task_class = next(
    n
    for n in config_tree.body
    if isinstance(n, ast.ClassDef) and n.name == "TaskConfig"
)
defaults = {
    n.target.id: ast.literal_eval(n.value)
    for n in task_class.body
    if isinstance(n, ast.AnnAssign)
    and isinstance(n.target, ast.Name)
    and n.target.id in ("target_delimiter", "fewshot_delimiter")
}
assert defaults == {"target_delimiter": " ", "fewshot_delimiter": "\n\n"}


class Task:
    fewshot_context = ns["fewshot_context"]
    build_qa_turn = ns["build_qa_turn"]
    multiple_input = False

    def resolve_field(self, doc, field):
        return field

    def doc_to_text(self, doc, field=None):
        return (field or self.format_target)(doc)

    def doc_to_choice(self, doc):
        return None

    def doc_to_target(self, doc, field=None):
        return doc["answer"] if field is None else field


def upstream_row(q):
    return {
        **q,
        "cot_content": q["cot"],
        **{
            f"option_{i}": q["options"][i] if i < len(q["options"]) else None
            for i in range(10)
        },
    }


questions = json.loads((ROOT / "tests/fixtures/questions.json").read_text())
reference = json.loads((ROOT / "packages/evaluation/src/reference.json").read_text())
# LANG_LIBS is an upstream literal; no model API imports are involved.
lang_ns = {}
exec((UPSTREAM / "lm_eval/tasks/mmlu_prox/lang_libs.py").read_text(), lang_ns)
result = {"referenceCommit": COMMIT, "prompts": {}, "extraction": {}}
for language in ("en", "ru"):
    template = (
        UPSTREAM / f"lm_eval/tasks/mmlu_prox/{language}/_{language}_lite_template_yaml"
    ).read_text()
    assert "sampler: first_n" in template and "num_fewshot: 5" in template
    assert 'doc_to_target: ""' in template and "fewshot_split: validation" in template
    pattern = re.search(r"regex_pattern: '(.*)'", template)[1]
    stops = [ast.literal_eval(s) for s in re.findall(r'^    - (".*")$', template, re.M)]
    local = {
        "lang_dict": lang_ns["LANG_LIBS"][language],
        "choices": list("ABCDEFGHIJKLMNOP"),
        "max_opt_num": 10,
    }
    definitions(
        f"lm_eval/tasks/mmlu_prox/{language}/utils.py",
        ["format_cot_example", "process_docs"],
        local,
    )
    result["prompts"][language] = {}
    for category, description in reference[language]["descriptions"].items():
        subject = category.replace("_", " ")
        pool = [
            upstream_row({**q, "category": subject})
            for q in questions
            if q["language"] == language
        ]
        target = next(q for q in pool if q["split"] == "test")

        # process_docs uses dataset.filter and preserves source order.
        class Rows(list):
            def filter(self, predicate):
                return Rows(q for q in self if predicate(q))

        validation = local["process_docs"](
            Rows(q for q in pool if q["split"] == "validation"), subject
        )
        task = Task()
        task.config = SimpleNamespace(
            description=description, test_split="test", doc_to_choice=None, **defaults
        )
        task.fewshot_cfg = SimpleNamespace(
            split="validation",
            doc_to_text=partial(local["format_cot_example"], including_answer=True),
            doc_to_choice=None,
            doc_to_target="",
            gen_prefix=None,
            **defaults,
        )
        task.sampler = ns["FirstNSampler"](validation)
        task.format_target = partial(
            local["format_cot_example"], including_answer=False
        )
        prompt = task.fewshot_context(target, 5)
        result["prompts"][language][category] = hashlib.sha256(
            prompt.encode()
        ).hexdigest()
    marker = "answer is " if language == "en" else "Ответ - "
    texts = [
        "",
        "B",
        "The answer is (B)",
        "Ответ - (B)",
        "ответ - (B)",
        "Ответ — (B)",
        "ANSWER IS (B)",
        "Answer is (B)",
        "answer  is (B)",
        "answer is\n(B)",
        "Ответ  - (B)",
        "Ответ -  (B)",
        "Ответ -\n(B)",
        "Ответ-(B)",
        marker + "(B). Explanation follows.",
        marker + "(A) or (B)",
        marker + "(A). " + marker + "(B)",
        marker + "(J). " + marker + "(B)",
        "**" + marker + "(B)**",
        marker + "**(B)**",
        "__" + marker + "(B)__",
        "not" + marker + "BLAH",
        marker + "(Ｂ)",
        marker + "(В)",
    ]
    texts += [
        marker + value
        for value in ("B", "(B)", "(B", "B)", "b", "(b)", "( B )", "K", "(J)", "(BB)")
    ]
    texts += [
        prefix + stop + suffix
        for stop in [*stops, "question:", "вопрос:"]
        for prefix, suffix in [("", marker + "(B)"), (marker + "(B)", marker + "(A)")]
    ]
    regex_filter = ns["RegexFilter"](regex_pattern=pattern)
    first_filter = ns["TakeFirstFilter"]()

    def extract(text):
        value = list(first_filter.apply(regex_filter.apply([[text]], [{}]), [{}]))[0]
        return None if value == "[invalid]" else value

    result["extraction"][language] = []
    for text in texts:
        stopped = ns["postprocess_generated_text"](text, stops, None)
        result["extraction"][language].append(
            {
                "text": text,
                "answer": extract(text),
                "stoppedText": stopped,
                "stoppedAnswer": extract(stopped),
            }
        )

path = ROOT / "packages/evaluation/fixtures/harness-parity.json"
path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(
    f"Generated 28 prompt hashes and {sum(map(len, result['extraction'].values()))} extraction/stop cases from {COMMIT}"
)

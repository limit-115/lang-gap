export default {
  title: "Every number needs a method.",
  intro: "A controlled comparison of prompt languages, with enough detail to reproduce the score.",
  protocolTitle: "The experiment",
  protocol:
    "Each request contains the localized instruction, five worked validation examples from the same subject, and one test question. Each prompt language uses the same question IDs, answer order and settings. There is no conversation history, browsing or tool use.",
  adaptation:
    "Our protocol follows the MMLU-ProX authors’ 5-shot CoT prompts. Native reasoning effort and configurable output limits replace the original decoding settings. It is an explicitly adapted protocol, not a reproduction of the paper’s scores.",
  datasetTitle: "The dataset",
  dataset:
    "MMLU-ProX Lite contains 588 test questions and 70 validation examples per language across 14 subjects. Only test questions contribute to accuracy. Source files and the prompt reference are pinned by revision and SHA-256. Automatic checks validate alignment, not the semantic quality of translations.",
  scoreTitle: "Accuracy & the language gap",
  accuracy: "Accuracy",
  score:
    "Accuracy is the proportion of correct answers, with equal weight per question. We average the prespecified repeats; we do not select the best answer. For each language pair, the gap is the difference in accuracy in percentage points. A and B follow the language order shown in the table’s gap column.",
  interval:
    "The 95% percentile interval uses 10,000 seeded paired bootstrap samples over unique question IDs, preserving the paired language results and all repeats together. Variation between repeats is reported separately. Effort labels do not imply equal compute across providers.",
  errorsTitle: "Errors & publication",
  errors:
    "Wrong, refused or unparseable completed answers score zero. Only technical failures are retried. Every attempt is retained. An incomplete matrix or a truncated response blocks publication. Changing a token limit creates a new experiment; it never selectively repairs wrong answers.",
  limitsTitle: "What this does not measure",
  limits:
    "These are public academic multiple-choice questions. Training contamination, translation quality and limited sample size may affect results. Scores do not establish a universal ranking for writing, conversation or professional work. Hosted model aliases can change even when a request uses the same model ID.",
  auditTitle: "Reproduce the result",
  audit:
    "Each immutable release includes its resolved configuration, dataset snapshot, prompts, visible outputs, usage and hashes. Scores and intervals can be recomputed without calling a model. API keys and transport headers are excluded.",
  sources: "Reference materials",
  datasetLink: "Pinned dataset",
  harnessLink: "Pinned prompt implementation",
} as const;

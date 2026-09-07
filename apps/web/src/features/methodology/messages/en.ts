export default {
  title: "Understand how we compare languages and calculate scores.",
  intro:
    "See what we ask each model, how we measure the difference, and how you can check a published result.",
  protocolTitle: "What each model receives",
  protocol:
    "We compare English and Russian versions of the same questions. Each prompt includes an instruction, five worked examples from the same subject, and one test question, all in the language being tested. Question IDs, answer order and model settings are matched across the language pair. Each request starts fresh, without conversation history, browsing or tools.",
  adaptation:
    "We use the MMLU-ProX authors’ prompts with five worked examples (5-shot CoT), adapted for hosted model APIs. We test each model at low, medium and high reasoning effort with a 2,048-token output limit that includes hidden reasoning. These API settings differ from the original study, so our scores are a separate comparison.",
  datasetTitle: "Which questions count",
  dataset:
    "MMLU-ProX Lite provides 588 test questions per language across 14 subjects. Another 70 examples supply the worked solutions shown in prompts; they do not count toward accuracy. We pin the dataset and prompt source versions and verify files with SHA-256 checksums. Automatic checks confirm that question IDs and answer choices align. They cannot establish that translations preserve the same meaning.",
  scoreTitle: "How to read accuracy and the gap",
  accuracy: "Accuracy",
  score:
    "Accuracy is the share of correct answers. Every question has equal weight, and we average all repeats specified before the run. The gap subtracts one language’s accuracy from the other, in percentage points. A and B below follow the order in the table’s gap column. Always read both accuracy scores: a small gap can also mean equally weak performance.",
  interval:
    "The 95% interval shows how precisely this question set lets us estimate the gap. We calculate it from 10,000 paired bootstrap samples with a fixed random seed, keeping each question’s language pair and all repeats together. Scores for individual repeats are also published. If the interval includes zero, the direction of the difference is uncertain. Matching effort labels do not mean equal computing budgets across providers.",
  errorsTitle: "How we handle errors before publication",
  errors:
    "We apply the published answer-extraction rule to every completed response. Incorrect or missing extracted answers score zero. Refusals and parsing failures are reported separately. We retry only technical failures and keep every attempt. Missing responses or outputs cut short by the token limit block publication. A new token limit requires a new experiment.",
  limitsTitle: "Where these results need caution",
  limits:
    "This comparison measures academic multiple-choice accuracy. Public questions may have appeared in training data, translations may contain errors, and the question set is limited. The interval captures variation across questions, not all of these uncertainties. Providers can update a hosted model behind the same model ID. Use the results to inform further testing on the writing, conversation or professional tasks that matter to you.",
  auditTitle: "How to check a published score",
  audit:
    "Download a release to inspect the exact settings, question data, prompts, visible model responses, token usage and file checksums. You can recompute scores and intervals without calling a model or paying for API access. Published releases stay unchanged; corrections receive a new release ID. API keys and transport headers remain private. Repeating live model requests can produce different answers.",
  sources: "Dataset and prompt sources",
  datasetLink: "View the dataset version we use",
  harnessLink: "View the prompt implementation we use",
} as const;

export default {
  guideTitle: "How the model overview combines tests",
  guide:
    "The overview averages published accuracy across available datasets with equal weight for each dataset. For example, 80% on one dataset and 90% on another gives 85%, regardless of their question counts. There is no correction for random guessing. Each API/model/effort configuration has a separate row.",
  guideCoverage:
    "For each dataset, model, API, effort and language, we select the newest run, then break ties by release date and ID. Repeated runs do not increase a dataset’s weight. All published datasets are discovered automatically. Token limits, repeat counts, dataset revisions and protocols remain source metadata, not eligibility filters. We average the available datasets and show their count; a dash means there are no results for that row and language. Cells can cover different datasets, so inspect their sources before comparing models.",
  guideDifference:
    "English is an optional display baseline. A language’s mean accuracy minus English mean accuracy is shown in percentage points only when both use the same dataset set, versions, protocols and aligned questions. Missing alignment hides the difference, not either accuracy. This descriptive difference has no inferred confidence interval. Original paired comparisons and all run settings remain in the published experiments.",

  title: "Understand how we compare languages and calculate scores.",
  intro:
    "Llang Gap is a multilingual benchmark across datasets. Each experiment selects its dataset, languages and protocol independently of the website display language.",
  protocolTitle: "What each model receives",
  protocol:
    "Each experiment selects a versioned protocol and one or more dataset languages. The protocol determines localized instructions, demonstrations and answer extraction. Every request starts fresh, without conversation history, browsing or tools. Model settings and repeats are recorded before execution.",
  adaptation:
    "The multiple-choice protocol uses pinned, localized instructions from the dataset manifest with no demonstrations and expects a single option letter. The separate MMLU-ProX adapter retains its reviewed author prompts and API adaptations. Supported inputs are declared by each dataset and protocol; they do not limit the benchmark to a fixed language pair.",
  datasetTitle: "Which questions count",
  dataset:
    "A dataset manifest pins source revision, files, languages, split sizes, normalization and SHA-256 checksums. Accuracy uses the selected language’s test questions; validation examples never count as test responses. Explicit paired comparisons require matching question IDs, categories, answer keys and option counts. Languages can also be evaluated independently. Automatic checks cannot establish semantic translation quality.",
  scoreTitle: "How to read accuracy and the gap",
  accuracy: "Accuracy",
  score:
    "Accuracy is the share of correct answers within one dataset and language, averaged over all prespecified repeats. Every question has equal weight. A gap is computed only for an explicitly selected aligned comparison: baseline accuracy minus comparison-language accuracy, in percentage points. A and B below follow the column’s subtraction order. Question counts from different datasets are never pooled; the overview averages dataset accuracies separately.",
  interval:
    "The 95% percentile interval shows how precisely this question set lets us estimate the gap. We calculate it from 10,000 paired bootstrap samples over unique question IDs with a fixed random seed, keeping each question’s language pair and all repeats together. Scores for individual repeats are also published. If the interval includes zero, the direction of the difference is uncertain. Matching effort labels do not mean equal computing budgets across API services.",
  errorsTitle: "How we handle errors before publication",
  errors:
    "We apply the published answer-extraction rule to every completed response. Incorrect or missing extracted answers score zero. Refusals and parsing failures are reported separately. We retry only technical failures and keep every attempt. Missing responses or outputs cut short by the token limit block publication. A new token limit requires a new experiment.",
  limitsTitle: "Where these results need caution",
  limits:
    "This comparison measures academic multiple-choice accuracy. Public questions may have appeared in training data, translations may contain errors, and the question set is limited. The interval captures variation across questions, not all of these uncertainties. API services can update a hosted model behind the same model ID. Use the results to inform further testing on the writing, conversation or professional tasks that matter to you.",
  auditTitle: "How to check a published score",
  audit:
    "Download a release to inspect the exact settings, question data, prompts, visible model responses, token usage and file checksums. You can recompute scores and intervals without calling a model or paying for API access. Published releases stay unchanged; corrections receive a new release ID. API keys and transport headers remain private. Repeating live model requests can produce different answers.",
  sources: "Dataset and protocol specifications",
  datasetLink: "Explore versioned dataset manifests",
  harnessLink: "Read the benchmark protocol specifications",
} as const;

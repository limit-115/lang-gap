export default {
  guideTitle: "How the model overview combines tests",
  guide:
    "The overview uses a fixed, versioned suite and one declared configuration per model. For each test, we subtract its random-guess baseline from accuracy, divide by the distance from that baseline to perfect accuracy, and scale to 100. Scores at or below random guessing receive zero. Fixed task weights are averaged within families, then fixed family weights produce a language score. This is an index, not a percentage of correct answers or a measure of conversational fluency.",
  guideCoverage:
    "Each language column requires the same complete test basis for every model. Missing evidence is shown as a dash, never zero or an average of the remaining tests. One compatible observation per test and language is selected by run creation time, then release date and ID; more runs or more questions do not increase its weight. Different API providers or effort levels are never silently averaged.",
  guideDifference:
    "The table uses English as an optional baseline: language score minus English score in percentage points, shown only when both scores have the same weighted, aligned test basis. It is a descriptive index difference. We do not infer its uncertainty by averaging individual test intervals. Original paired comparisons and all published experiments remain on model and release pages.",

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
    "Accuracy is the share of correct answers within one dataset and language, averaged over all prespecified repeats. Every question has equal weight. A gap is computed only for an explicitly selected aligned comparison: baseline accuracy minus comparison-language accuracy, in percentage points. A and B below follow the column’s subtraction order. Scores from different datasets are never pooled.",
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

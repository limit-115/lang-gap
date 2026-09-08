export default {
  guideTitle: "How the homepage adds it up",
  guide:
    "Each available dataset gets an equal vote in the average: 80% on one and 90% on another gives 85%, regardless of how many questions each contains. We don’t adjust for random guessing. Each API, model and effort configuration gets its own row.",
  guideCoverage:
    "For each dataset, model, API, effort and language, we use the newest run, even when its score drops. Release date and ID break ties. Extra runs and repeats don’t give a dataset more weight. All published datasets are included automatically; token limits, repeat counts, revisions and protocols stay in the source metadata rather than filtering runs out. We show how many datasets went into each average. A dash means missing results. Different cells can cover different datasets, so check their sources before comparing.",
  guideDifference:
    "When comparable English results exist, the table can show a language’s mean accuracy minus English mean accuracy in percentage points. Both sides must use the same datasets, versions, protocols and aligned questions. If they don’t match, we leave out the difference and keep both scores. This is a descriptive difference with no inferred confidence interval. The original per-dataset paired comparisons and run settings remain in the published experiments.",

  title: "Here’s how we got those numbers.",
  intro:
    "A fluent answer can still be wrong. We test LLMs on questions with known answers, across datasets and languages. Here’s what we measure, how we count it, and what the scores leave out.",
  protocolTitle: "What the model sees",
  protocol:
    "Before a run, we choose a dataset, one or more languages and a versioned test protocol. The protocol sets the instructions, any worked examples and how we extract answers. Each request starts fresh: no chat history, browsing or tools. We record the model settings and repeat counts before the run.",
  adaptation:
    "The general multiple-choice protocol uses the dataset’s pinned, localized instructions, gives no worked examples and asks for a single option letter. MMLU-ProX has its own adapter, with reviewed author prompts and API adaptations. Each dataset and protocol declares which inputs it supports. The website’s display language has no say in which languages we test.",
  datasetTitle: "Which questions count",
  dataset:
    "We pin each dataset’s source revision, files, languages, split sizes, normalization rules and SHA-256 checksums. Only test questions count toward accuracy; validation examples don’t. You can test a language on its own. To calculate a paired gap, question IDs, categories, answer keys and option counts must match. Those checks can’t tell us whether a translation preserves the meaning.",
  scoreTitle: "How we count correct answers",
  accuracy: "Accuracy",
  score:
    "Within each dataset and language, accuracy is the share of correct answers, averaged over every repeat we planned. Each question gets equal weight. For an explicitly selected, aligned comparison, the gap is baseline accuracy minus comparison-language accuracy, in percentage points. A and B below follow that order. We never pool question counts across datasets; the homepage averages each dataset’s accuracy separately.",
  interval:
    "The 95% percentile interval tells us how precisely this question set lets us estimate the gap. We draw 10,000 paired bootstrap samples over unique question IDs using a fixed random seed, keeping each question’s language pair and all repeats together. We publish each repeat’s score too. If the interval includes zero, we can’t call the direction of the difference. The same effort label can mean different computing budgets across APIs.",
  errorsTitle: "When a run goes wrong",
  errors:
    "We apply the published answer-extraction rule to every completed response. A wrong answer, a refusal or an answer we can’t extract scores zero. We report refusals and extraction failures separately. We retry only technical failures and keep every attempt. Missing responses or answers cut off by the token limit block publication. Changing that limit means starting a new experiment.",
  limitsTitle: "What these scores can’t tell you",
  limits:
    "These tests measure academic multiple-choice accuracy. Public questions may have been in a model’s training data. Translations can be wrong. The question set is limited. Our interval captures variation across questions, not all those uncertainties. An API service can also change a model behind the same ID. Use the results to make a shortlist, then test on the writing, conversations or professional tasks you actually need.",
  auditTitle: "Check our work",
  audit:
    "Download a release and you can inspect the exact settings, questions, prompts, visible model responses, token usage and file checksums. You can recompute scores and intervals without calling a model or paying for API access. Published releases stay put. Corrections get a new release ID. We keep API keys and transport headers private. If you rerun the models themselves, their answers may change.",
  sources: "Go straight to the source",
  datasetLink: "See the dataset files and versions",
  harnessLink: "Read the full test protocol",
} as const;

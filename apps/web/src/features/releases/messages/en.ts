export default {
  metadataTitle: "Benchmark releases and open data",
  detailTitle: "Benchmark release {id}",
  detailDescription:
    "Model accuracy on {dataset}, using {protocol}. This release records the tested languages, scores, explicit language comparisons and downloadable evidence.",
  sample:
    "{count, plural, one {# unique question per language} other {# unique questions per language}} · {repeats, plural, one {# repeat} other {# repeats}}",
  methodology: "How we test and interpret the gap",
  repeatScores: "Accuracy by repeat",
  repeat: "Repeat {number}",
  counts: "{refusals} refusals · {unparseable} unparseable answers",
  costs: "Selected completed responses: {cost}. Total run spending is recorded in execution.json.",
  unknownCost: "cost unknown",
  citation: "Cite this release",
  citationText:
    "Limit 115. Llang Gap: {dataset}. Release {id}, created {date}. Protocol: {protocol}.",
  fileCreated: "Release created {date}",
  scope:
    "These results measure academic multiple-choice accuracy, not overall language ability. If the gap interval includes zero, the comparison does not establish which language has higher accuracy. Matching reasoning effort labels do not imply equal computing budgets.",
  title: "Explore published results and the evidence behind them.",
  intro:
    "Each release keeps the scores, settings and model responses together so you can check the findings. Corrections appear in a new release; earlier versions stay available.",
  emptyTitle: "No published releases.",
  back: "Back to release history",
  download: "Download",
  config: "Experiment settings",
  items: "Prompts and model responses",
  data: "Questions used in this release",
  aggregate: "Scores and uncertainty intervals",
  created: "Published {date}",
  protocol: "Protocol",
  revision: "Dataset version",
  integrity: "File checksums · SHA-256",
  audit:
    "Download all files in this release to check their integrity and recompute the scores with the benchmark CLI. Verification needs no model requests or API keys.",
  missing: "This release is not published.",
} as const;

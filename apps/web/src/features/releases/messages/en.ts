export default {
  title: "Explore published results and the evidence behind them.",
  intro:
    "Each release keeps the scores, settings and model responses together so you can check the findings. Corrections appear in a new release; earlier versions stay available.",
  emptyTitle: "No benchmark results published yet",
  emptyDescription: "Read how the first comparison is set up and what we check before publishing.",
  methodologyLink: "See how we test",
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
  missing: "This release has not been published. Check the release history for available results.",
} as const;

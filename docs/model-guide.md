# Interpreting the homepage

`mean-dataset-accuracy-v1` selects the newest run per dataset/transport/model/effort/language, never the best.
Release time then ID break ties; absent run-time evidence falls back to release time.
Selected dataset accuracies have equal weight: 80% on 5 questions and 90% on 500 produce 85%.
Repeats or extra publications do not increase a dataset's weight. Translation dataset IDs remain distinct.
Only available datasets contribute. A dash is missing evidence; a measured zero is zero.
Different cells may cover different datasets, difficulty, caps or protocols: this is descriptive, not a controlled ranking.
Language-minus-English annotations require matching dataset identities, revisions, protocols and aligned questions;
they use the opposite subtraction order to runner gaps. No composite confidence interval is inferred.
Inspect source results before interpreting a difference; effort labels do not equate compute across APIs.
Historical schema-v1 normalized/weighted guides retain their saved methodology and immutable scores.
Formula or selection changes require a new aggregation identity and summary snapshot; see [publication](releases.md).

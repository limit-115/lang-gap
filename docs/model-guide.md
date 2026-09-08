# Interpreting the homepage

The comparison table shows every matching model configuration in one scrollable page.
Search by model or developer, filter by reasoning effort, or sort a language column;
English always appears immediately after reasoning effort and cannot be hidden.
Other language columns can be selected independently, with horizontal scrolling
when they exceed the available width. The language selector's “Select all” and
“Clear all” actions apply to the whole list, including during a search; “Clear all”
keeps English visible. The English column is a display reference,
not a required experiment input; rows without English evidence show a dash.
Scores and any aligned differences appear side by side, using English as the
baseline only when comparable English evidence exists.

Model names and scores open model-specific results. The link icon in each language
header targets `/[locale]/languages/<tag>/`, the same reserved destination as the
language finder; language detail pages are still planned. The adjacent language
name and arrow sort the current table.

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

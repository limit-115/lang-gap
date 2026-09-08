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
header opens `/[locale]/languages/<tag>/`, also available from the language finder.
The adjacent language name and arrow sort the current table.

Language pages read the same verified published summary as the homepage. They show
leading results, shared ranks for ties, and the range of available scores. Each
reasoning level remains a separate result; scores are never averaged across model
configurations. Benchmark filters appear when more than one dataset is available.
The header reuses the homepage’s searchable language finder. The table shows
gaps to the highest score, with negative differences in red. Model names, scores,
and card links open the model’s results page with the language and tested
reasoning effort selected. `?view=compare` opens a comparison of up to three results. Historical normalized guides are not displayed as accuracy percentages.

Model pages show the selected published row as a language accuracy chart. Links
from the homepage and language pages identify the model in the path and preserve
reasoning effort in `?effort=…`, with optional `&language=…` highlighting. Transport
and raw model IDs are runner provenance, not website navigation state; legacy
`transport` and `model` query parameters are ignored. Model-finder links use the
first matching row in the published guide, never the highest-scoring row. Each
effort appears once in the reasoning selector; if runner profiles share a model
and effort, the first published row supplies its unchanged scores. Missing
requested efforts remain unavailable instead of falling back to another setting.

The model-page header reuses the homepage's searchable model finder. Switching
models keeps the requested language highlighted when it is available and opens
the destination model's default published row.

Language rows always sort by highest score. A successful language search also
keeps any published English rows visible for context; searches with no matches
show the empty state. This is a display rule only and does not require English
in a benchmark or add missing results.

The highest and lowest scores include tied languages. Their difference appears
only with at least two measured languages sharing the same comparison basis; it
is a descriptive range, not a paired estimate. One-language and incompatible
evidence selections show no range. Experiment history and configuration details
remain on the linked release pages.

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

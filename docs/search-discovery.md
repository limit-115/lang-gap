# Search and AI discovery

The public origin is currently `https://llang-gap-web.vercel.app`. `SITE_URL`
overrides it for a future domain. Use an HTTPS origin with no path, query or
credentials; localhost is rejected so production cannot advertise development
URLs. `.env.example` is documentation, not a deployed environment setting. If
Vercel already defines `SITE_URL`, update that setting before deployment.

Page metadata and the sitemap own EN/RU alternate links and the English
`x-default`. next-intl's request-host alternate headers are disabled to avoid
conflicting hints. Language detection and the locale cookie still operate.
`VERCEL_ENV=preview` emits page `noindex` and an empty sitemap; robots remains
crawlable so crawlers can see `noindex`. Both origin and deployment environment
participate in Turborepo's cache key. A preview is not confidential storage.

## Before the first release

- Keep home and methodology indexable and describe the comparison as planned.
  Do not publish inferred winners, synthetic scores or result claims.
- Empty release history remains navigable but has `noindex, follow` and is omitted
  from the sitemap. It becomes indexable when the first benchmark is indexed.
  Unknown release IDs return 404. The homepage describes a `WebSite`, not an
  available `Dataset`.
- Verify a URL-prefix property for the current origin in Google Search Console
  and Bing Webmaster Tools. Submit `/sitemap.xml`; inspect `/en/` and
  `/en/methodology/`, including the engine-selected canonical after indexing.
- Check Search Console's **Settings → Search generative AI** inclusion and
  inheritance. Inclusion is the default, but the actual account setting must be
  checked. See [Google's control documentation](https://support.google.com/webmasters/answer/16908024).
- Check public HTML, CSS and assets are accessible without a CAPTCHA or login.
  A spoofed user-agent request is a basic HTTP check, not proof that a real
  search crawler can pass the hosting provider's bot controls.

## Publishing a citable result

Follow [the release guide](releases.md) first. The website validates indexed
benchmark manifests, checks `aggregate.json` bytes against their recorded hash,
matches parsed scores to the manifest, and checks per-repeat array lengths. This
does not replace independent `release verify` or remote artifact checks.

Each indexed release generates `/en/releases/<id>/` and `/ru/releases/<id>/`
with the same full score table in initial HTML, scope limitations, per-repeat
scores, costs, protocol, dataset revision, downloads, checksums and citation
text. The release view does not paginate away evidence. Existing release IDs stay
immutable. `createdAt` is labeled **release created**, not assumed to be the date
of public publication or model evaluation.

Release pages emit `Dataset` JSON-LD with a shared dataset identity across locales.
CSV/JSON `DataDownload` entries point to the declared public asset base. Do not
advertise unavailable downloads, invent a publication date, or infer an artifact
license from the repository's code license. The current manifest has no rights
declaration; establish and document reuse rights before adding a `license` field.
[Google's Dataset guidance](https://developers.google.com/search/docs/appearance/structured-data/dataset)
describes Dataset Search eligibility, not a guarantee of AI citation or ranking.

Before making the indexed release public:

1. Verify every remote artifact URL and its bytes, including `manifest.json` and
   aggregate CSV/JSON. Preserve upstream attribution with downloads.
2. Inspect each locale's raw HTML, Dataset markup, canonical and alternate links.
   Check unknown releases return 404 and no synthetic IDs enter the index.
3. Review interpretation against the protocol. Intervals containing zero do not
   establish a direction. Do not equate native effort labels or treat repeats
   as independent questions.
4. Prepare a dated analysis with a real byline, release permalink, sample, exact
   model/protocol scope, findings and limitations. Write conclusions only after
   the verified aggregates exist.
5. Inspect the deployed sitemap and submit changed URLs through webmaster tools.
   Consider IndexNow for Bing if publication becomes frequent.

Language-detail URLs (`/{locale}/languages/{tag}/`) in the homepage finder are
reserved and not implemented. Keep them out of the sitemap until substantive
language pages exist; the selector currently navigates to these 404 destinations. Share images
and real maintainer/editorial profiles are useful follow-up work.

## AI crawler policy

The wildcard allow rule permits public search and retrieval crawlers. No training
policy change is bundled with discovery preparation. Search and training controls
are distinct:

| Service    | Search or retrieval                                    | Separate control                                                    |
| ---------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| Google     | Googlebot and Search Console's generative AI inclusion | Google-Extended covers specified training and Gemini grounding uses |
| OpenAI     | OAI-SearchBot; ChatGPT-User for requested visits       | GPTBot for potential training                                       |
| Anthropic  | Claude-SearchBot; Claude-User for requested visits     | ClaudeBot for potential training                                    |
| Perplexity | PerplexityBot; Perplexity-User for requested visits    | These are documented as not training crawlers                       |

Consult current [OpenAI](https://developers.openai.com/api/docs/bots),
[Anthropic](https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler),
[Perplexity](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) and
[Google](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers#google-extended)
documentation before changing rules. Use published IP ranges to verify bots;
user-agent text alone is not identity. Serve readers and bots the same findings.

`llms.txt`, bot-only instructions and an MCP server are not launch prerequisites.
[Google's AI guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
says Google Search ignores `llms.txt` and requires no special AI schema. Prefer
readable evidence and downloadable aggregates. Add interfaces when consumers need them.

## Measurement after publication

Track indexed pages, AI impressions/citations, human referrals, and useful actions
such as artifact downloads or reproducibility work as separate outcomes.
Google's [Generative AI performance report](https://support.google.com/webmasters/answer/16984139)
documents impressions, not dedicated conversion attribution; low-volume sites may
not see it. [Bing AI Performance](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c)
reports sampled citations and grouped grounding queries, not full prompts or
clicks. Neither proves a content change caused an increase.

Keep a small, versioned set of EN/RU questions for manual AI checks: discovery,
model/language comparisons, protocol interpretation and reproducibility. Record
date, product/search mode, locale, prompt, cited URL, release ID, numerical
accuracy and whether limitations survive. Separate brand-seeded prompts from
unprompted discovery. Repeated answers are observations, not a population estimate.
No automated model calls or recurring monitoring are configured here.

When moving to a custom domain, preserve paths, redirect the previous public
origin permanently, update `SITE_URL`, rebuild, verify canonical/alternate/schema
URLs, and submit the new sitemap. Keep old release links resolving.

# Required repository instructions

Before starting any work in `apps/web`, read and follow the repository's
[root AGENTS.md](../../AGENTS.md) and the documents it requires. This file adds
website-specific instructions; it does not replace the repository-wide rules.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Design requirements

- Follow the [website voice guide](../../docs/voice.md) for copy and translations.
- Use shadcn/ui, initialized with preset `b2pjsub2m` and `--pointer`.
- Use Inter for interface text and JetBrains Mono for monospace content.
- Keep the design clean and precise, with readable text and consistent spacing.
- Reuse the `--type-*` scale in `src/app/globals.css` for model, language, and run-builder
  pages. Use 400/500/600 weights; keep UI text at 14px and secondary captions at least
  12px. Adapt narrow layouts instead of shrinking labels, names, or chart values.
- Use `SearchInput` for list/table filters and `SearchComboboxInput` within Base UI
  comboboxes for navigation finders. Both live in `src/components/ui/search-input.tsx`
  and share field styling: 36px for filters, 48px for finders. Keep page-specific
  layout outside these controls; change their appearance and clearing behavior in
  the shared component rather than adding feature-level input overrides.
- Do not add eyebrow labels, decorative letter spacing, or section prefixes such as `01 /`.

## Link consistency

Follow [website link conventions](../../docs/web-links.md). Use the shared link
components for navigation and the development-only `/en/design/links` examples
when reviewing interaction states. Do not add feature-specific link styles or
manual external-link indicators.

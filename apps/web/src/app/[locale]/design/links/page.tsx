import { ArrowRight, FileArchive, Link2 } from "lucide-react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ButtonLink, IconLink, LinkSurface, NavLink, TextLink } from "@/shared/links/link";

export default async function LinkExamples({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (process.env.NODE_ENV !== "development" || locale !== "en") notFound();
  setRequestLocale(locale);

  return (
    <article className="space-y-8 py-12">
      <header className="space-y-3">
        <h1>Link examples</h1>
        <p>Compare the shared link roles with a pointer, the Tab key, and both themes.</p>
      </header>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Text and data</h2>
        <p>
          Read <TextLink href="/methodology">how we test</TextLink>, or check the{" "}
          <TextLink href="https://github.com/limit-115/llang-gap">source code</TextLink>.
        </p>
        <div className="flex flex-wrap items-center gap-6">
          <TextLink href="/releases" layout="standalone" direction="back">
            Release history
          </TextLink>
          <TextLink href="/languages/ja?view=compare" layout="standalone" direction="forward">
            Compare models
          </TextLink>
          <TextLink href="/methodology" layout="data">
            <span data-link-label>Model name</span>
            <span className="ml-2 text-muted-foreground">Metadata</span>
          </TextLink>
          <TextLink href="/methodology" layout="data" className="font-mono">
            <span data-link-label>82.4</span>
            <span className="ml-2 text-emerald-700 dark:text-emerald-400">+2.0pp</span>
          </TextLink>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Calls to action and files</h2>
        <div className="flex flex-wrap items-center gap-6">
          <ButtonLink href="/run" size="lg" direction="forward">
            Build a run
          </ButtonLink>
          <ButtonLink href="https://t.me/dibenkobit" variant="outline" newTab>
            Support the project
          </ButtonLink>
          <TextLink href="https://example.org/manifest.json" className="font-mono">
            manifest.json
          </TextLink>
          <ButtonLink
            href="data:text/plain;charset=utf-8,Link%20example"
            variant="outline"
            download="example.txt"
          >
            Download example
          </ButtonLink>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Navigation and surfaces</h2>
        <nav aria-label="Examples" className="flex items-center gap-6">
          <NavLink href="/design/links">Link examples</NavLink>
          <NavLink href="/methodology">How we test</NavLink>
          <IconLink href="/languages/ja" aria-label="Compare models in Japanese">
            <Link2 aria-hidden="true" />
          </IconLink>
        </nav>
        <div className="grid gap-5 sm:grid-cols-2">
          <LinkSurface
            href="/releases"
            kind="row"
            className="flex items-center gap-4 rounded-lg border bg-background p-5"
          >
            <FileArchive aria-hidden="true" />
            <span>Release history</span>
            <ArrowRight aria-hidden="true" className="ml-auto size-4" />
          </LinkSurface>
          <LinkSurface
            href="/languages/ja"
            className="space-y-2 rounded-lg border bg-background p-5"
          >
            <strong>Language results</strong>
            <p>Scores and comparison details</p>
          </LinkSurface>
        </div>
      </section>
    </article>
  );
}

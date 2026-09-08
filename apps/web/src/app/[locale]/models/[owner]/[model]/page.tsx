import { ArrowLeft } from "lucide-react";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { guideModelIdentity } from "@llang-gap/contracts/guide";
import { routing } from "@/i18n/routing";
import { getMessagesForLocale } from "@/i18n/messages";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/shared/metadata";
import { getReleases } from "@/features/releases/data";
import { getModelGuide } from "@/features/leaderboard/guide-data";
import { getModelPresentation } from "@/features/leaderboard/model-catalog";
import { modelGuideHref } from "@/features/leaderboard/table-state";
import { ModelOwnerLogo } from "@/features/leaderboard/model-owner-logo";
import { ModelResults } from "@/features/models/model-results";

type Props = {
  params: Promise<{ locale: string; owner: string; model: string }>;
  searchParams: Promise<{ language?: string; effort?: string; transport?: string; model?: string }>;
};

async function getModel(owner: string, name: string) {
  const id = `${owner}/${name}`;
  const releases = (await getReleases())
    .map((release) => ({
      ...release,
      aggregate: release.aggregate.filter((row) => guideModelIdentity(row).id === id),
    }))
    .filter((release) => release.aggregate.length > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const reference = releases[0]?.aggregate[0];
  if (!reference) notFound();
  return { id, reference, releases, ...getModelPresentation(reference) };
}

export async function generateStaticParams() {
  const models = new Map(
    (await getReleases()).flatMap((release) =>
      release.aggregate.map((row) => {
        const identity = guideModelIdentity(row);
        return [
          identity.id,
          {
            owner: identity.id.slice(0, identity.id.length - identity.name.length - 1),
            model: identity.name,
          },
        ] as const;
      }),
    ),
  );
  return [...models.values()];
}

export async function generateMetadata({ params }: Props) {
  const { locale, owner, model } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const data = await getModel(owner, model);
  const t = await getTranslations({ locale, namespace: "Models" });
  return pageMetadata(
    locale,
    modelGuideHref(data.reference),
    data.label,
    t("description", { model: data.label }),
  );
}

export default async function ModelPage({ params, searchParams }: Props) {
  const { locale, owner, model } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const data = await getModel(owner, model);
  const guide = await getModelGuide();
  const t = await getTranslations("Models");
  const messages = getMessagesForLocale(locale);
  const selection = await searchParams;
  const { language } = selection;
  return (
    <article className="min-w-0 pb-16">
      <header className="intro">
        <Link href="/" className="resource-link mb-6">
          <ArrowLeft aria-hidden="true" />
          <span>{t("back")}</span>
        </Link>
        <div className="flex items-center gap-4">
          <ModelOwnerLogo ownerId={data.ownerId} size={40} />
          <h1>{data.label}</h1>
        </div>
        <p>{data.ownerName}</p>
      </header>
      <NextIntlClientProvider
        messages={{
          Models: messages.Models,
          Leaderboard: messages.Leaderboard,
          Releases: messages.Releases,
        }}
      >
        <ModelResults
          model={
            guide?.models.find(
              (entry) =>
                entry.id === data.id &&
                (!selection.effort ||
                  (entry.profile?.effort === selection.effort &&
                    entry.profile.transport === selection.transport &&
                    entry.profile.model === selection.model)),
            ) ?? null
          }
          releases={data.releases}
          name={data.label}
          suiteId={guide?.plan.suite.id ?? null}
          taskCount={guide?.plan.suite.tasks.length ?? 0}
          initialLanguage={typeof language === "string" ? language : null}
        />
      </NextIntlClientProvider>
    </article>
  );
}

import { languageLabel } from "@/shared/language-label";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { guideModelIdentity } from "@llang-gap/contracts/guide";
import { routing } from "@/i18n/routing";
import { getMessagesForLocale } from "@/i18n/messages";
import { pageMetadata } from "@/shared/metadata";
import { getReleases } from "@/features/releases/data";
import { getModelGuide } from "@/features/leaderboard/guide-data";
import { getModelPresentation } from "@/features/leaderboard/model-catalog";
import { modelGuideHref } from "@/features/leaderboard/table-state";
import { ModelResults } from "@/features/models/model-results";
import { getModelOverviewProfiles, selectModelOverview } from "@/features/models/overview-data";

type Props = {
  params: Promise<{ locale: string; owner: string; model: string }>;
  searchParams: Promise<{ language?: string | string[]; effort?: string | string[] }>;
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
  const messages = getMessagesForLocale(locale);
  const query = await searchParams;
  const language = typeof query.language === "string" ? query.language : null;
  const profiles = getModelOverviewProfiles(guide?.models ?? [], data.id);
  const selected = selectModelOverview(profiles, data.id, {
    effort: typeof query.effort === "string" ? query.effort : undefined,
  });
  // Browser ICU support varies for native names. Keep SSR and hydration identical.
  const languageNames = Object.fromEntries(
    (selected?.scores ?? []).map(({ language }) => [
      language,
      {
        local: languageLabel(language, locale),
        native: languageLabel(language, language),
      },
    ]),
  );
  const sourceIds = new Set(
    selected?.scores.flatMap((score) => score.contributions.map((entry) => entry.releaseId)) ?? [],
  );
  const sources = sourceIds.size
    ? data.releases.filter((release) => sourceIds.has(release.id))
    : data.releases;
  return (
    <NextIntlClientProvider
      messages={{
        Models: messages.Models,
        Leaderboard: messages.Leaderboard,
      }}
    >
      <ModelResults
        key={selected ? `${selected.id}/${selected.profile?.effort ?? "published"}` : "unavailable"}
        model={selected}
        profiles={profiles}
        modelOptions={guide?.models.map((entry) => entry.reference) ?? []}
        name={data.label}
        languageNames={languageNames}
        ownerId={data.ownerId}
        ownerName={data.ownerName}
        updatedAt={sources[0]?.createdAt ?? null}
        isSummary={guide?.plan.schemaVersion === 2}
        initialLanguage={language}
        sourceCount={sources.length}
        sourceHref={sources.length === 1 ? `/releases/${sources[0]!.id}` : "/releases"}
      />
    </NextIntlClientProvider>
  );
}

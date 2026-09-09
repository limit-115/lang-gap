import { getModelIdentity, type ReleaseManifest } from "@llang-gap/contracts";
import { getModelPresentation } from "@/features/leaderboard/model-catalog";

export function releaseModels(release: ReleaseManifest) {
  return [
    ...new Map(
      release.aggregate.map((row) => {
        const identity = getModelIdentity(row);
        return [JSON.stringify(identity), getModelPresentation(row)];
      }),
    ).values(),
  ];
}

// Publication days use UTC, matching the date on each immutable release page.
export function groupReleasesByDay<T extends Pick<ReleaseManifest, "id" | "createdAt">>(
  releases: readonly T[],
  oldestFirst = false,
) {
  const sorted = [...releases].sort((a, b) => {
    const difference = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return (oldestFirst ? -difference : difference) || a.id.localeCompare(b.id, "en");
  });
  const groups = new Map<string, T[]>();
  for (const release of sorted) {
    const day = new Date(release.createdAt).toISOString().slice(0, 10);
    const items = groups.get(day) ?? [];
    items.push(release);
    groups.set(day, items);
  }
  return [...groups].map(([day, reports]) => ({ day, reports }));
}

export function matchesRelease(release: ReleaseManifest, query: string, locale: string) {
  const names = new Intl.DisplayNames([locale], { type: "language" });
  const text = [
    release.id,
    release.dataset,
    release.protocol,
    ...releaseModels(release).flatMap((model) => [model.label, model.ownerName]),
    ...release.languages.flatMap((language) => [language, names.of(language)]),
  ]
    .join(" ")
    .toLocaleLowerCase(locale);
  return query
    .trim()
    .toLocaleLowerCase(locale)
    .split(/\s+/)
    .every((word) => text.includes(word));
}

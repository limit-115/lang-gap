import type { GuideModel } from "@llang-gap/contracts/guide";

export function filterModelLanguages<T extends { language: string; label: string; native: string }>(
  rows: readonly T[],
  search: string,
  locale: string,
): T[] {
  const query = search.trim().toLocaleLowerCase(locale);
  const matches = new Set(
    rows.filter((row) =>
      `${row.label} ${row.native} ${row.language}`.toLocaleLowerCase(locale).includes(query),
    ),
  );
  if (!matches.size) return [];
  // Keep published English rows as context for a successful search, in score order.
  return rows.filter((row) => matches.has(row) || new Intl.Locale(row.language).language === "en");
}

export function selectModelOverview(
  models: readonly GuideModel[],
  id: string,
  selection: { effort?: string; transport?: string; model?: string },
) {
  return (
    models.find(
      (entry) =>
        entry.id === id &&
        (!selection.effort || entry.profile?.effort === selection.effort) &&
        (!selection.transport || entry.profile?.transport === selection.transport) &&
        (!selection.model || entry.profile?.model === selection.model),
    ) ?? null
  );
}

export function summarizeModelScores(model: GuideModel | null) {
  const scores = model?.scores ?? [];
  const measured = scores
    .filter(
      (score): score is typeof score & { value: number } =>
        score.status === "ready" && score.value !== null,
    )
    .sort((a, b) => b.value - a.value || a.language.localeCompare(b.language));
  const highest = measured[0]?.value ?? null;
  const lowest = measured.at(-1)?.value ?? null;
  return {
    scores,
    measured,
    highest,
    lowest,
    highestLanguages: measured
      .filter((score) => highest !== null && Math.abs(score.value - highest) < 1e-9)
      .map((score) => score.language),
    lowestLanguages: measured
      .filter((score) => lowest !== null && Math.abs(score.value - lowest) < 1e-9)
      .map((score) => score.language),
    // A displayed language difference requires compatible published evidence.
    // It is a score range, not a paired estimate or confidence interval.
    spread:
      measured.length > 1 &&
      measured.every((score) => score.comparisonBasis === measured[0]?.comparisonBasis)
        ? highest! - lowest!
        : null,
  };
}

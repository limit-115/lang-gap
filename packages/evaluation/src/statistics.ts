import {
  aggregateSchema,
  type Aggregate,
  type Comparison,
  type ItemResult,
} from "@llang-gap/contracts";

export function seededRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffled<T>(values: readonly T[], seed: number): T[] {
  const result = [...values];
  const random = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) throw new Error("Invalid shuffle index");
    result[i] = b;
    result[j] = a;
  }
  return result;
}
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

export function aggregateResults(
  items: readonly ItemResult[],
  seed: number,
  samples = 10_000,
  conditions: { languages: readonly string[]; comparisons: readonly Comparison[] },
): Aggregate[] {
  if (!items.length) throw new Error("No results to aggregate");
  if (!Number.isSafeInteger(samples) || samples < 1)
    throw new Error("At least one bootstrap sample required");
  const groups = new Map<string, ItemResult[]>();
  for (const item of items) {
    if (!conditions.languages.includes(item.language))
      throw new Error("Unselected result language");
    const key = `${item.transport}/${item.model}/${item.effort}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => {
      const first = group[0]!;
      const repeats = Math.max(...group.map((i) => i.repeat)) + 1;
      const lookup = new Map(group.map((i) => [`${i.questionId}/${i.language}/${i.repeat}`, i]));
      if (lookup.size !== group.length) throw new Error("Incomplete or duplicated results");
      const clusters = new Map<string, Map<string, number>>();
      const scores = conditions.languages.map((language) => {
        const ids = [
          ...new Set(group.filter((i) => i.language === language).map((i) => i.questionId)),
        ].sort();
        if (!ids.length) throw new Error(`Incomplete results: ${language}`);
        const repeatAccuracy = Array.from({ length: repeats }, () => 0);
        const questionScores = new Map(
          ids.map((id) => {
            const values = Array.from({ length: repeats }, (_, repeat) => {
              const row = lookup.get(`${id}/${language}/${repeat}`);
              if (!row) throw new Error("Incomplete language/repeat results");
              repeatAccuracy[repeat] =
                (repeatAccuracy[repeat] ?? 0) + Number(row.correct) / ids.length;
              return Number(row.correct);
            });
            return [id, mean(values)] as const;
          }),
        );
        clusters.set(language, questionScores);
        return {
          language,
          n: ids.length,
          accuracy: Math.min(1, mean(repeatAccuracy)),
          repeatAccuracy: repeatAccuracy.map((score) => Math.min(1, score)),
        };
      });
      const comparisons = conditions.comparisons.map(({ baseline, language }) => {
        const a = clusters.get(baseline);
        const b = clusters.get(language);
        if (!a || !b || a.size !== b.size || [...a.keys()].some((id) => !b.has(id)))
          throw new Error("Incomplete aligned comparison results");
        const differences = [...a].map(([id, score]) => 100 * (score - b.get(id)!));
        const random = seededRandom(seed);
        const bootstrap = Array.from({ length: samples }, () => {
          let sum = 0;
          for (let i = 0; i < differences.length; i++)
            sum += differences[Math.floor(random() * differences.length)]!;
          return sum / differences.length;
        }).sort((a, b) => a - b);
        const quantile = (p: number) => {
          const index = (bootstrap.length - 1) * p;
          const lo = bootstrap[Math.floor(index)]!;
          const hi = bootstrap[Math.ceil(index)]!;
          return lo + (hi - lo) * (index - Math.floor(index));
        };
        return {
          baseline,
          language,
          n: a.size,
          gapPp: mean(differences),
          gapCi95: [quantile(0.025), quantile(0.975)],
        };
      });
      return aggregateSchema.parse({
        transport: first.transport,
        model: first.model,
        effort: first.effort,
        repeats,
        scores,
        comparisons,
        unparseable: group.filter((i) => i.outcome === "completed" && i.answer === null).length,
        refusals: group.filter((i) => i.outcome === "refusal").length,
        costUsd: group.some((i) => i.costUsd === null)
          ? null
          : group.reduce((sum, i) => sum + (i.costUsd ?? 0), 0),
      });
    });
}

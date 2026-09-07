import { aggregateSchema, type Aggregate, type ItemResult } from "@llang-gap/contracts";

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
): Aggregate[] {
  if (!items.length) throw new Error("No results to aggregate");
  const groups = new Map<string, ItemResult[]>();
  for (const item of items) {
    const key = `${item.provider}/${item.model}/${item.effort}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => {
      const first = group[0];
      if (!first) throw new Error("Empty group");
      const ids = [...new Set(group.map((i) => i.questionId))].sort();
      const repeats = Math.max(...group.map((i) => i.repeat)) + 1;
      const lookup = new Map(group.map((i) => [`${i.questionId}/${i.language}/${i.repeat}`, i]));
      if (lookup.size !== group.length || group.length !== ids.length * 2 * repeats)
        throw new Error("Incomplete or duplicated paired results");
      const accuracy = { en: [] as number[], ru: [] as number[] };
      const differences = ids.map((id) => {
        const scores = { en: [] as number[], ru: [] as number[] };
        for (const language of ["en", "ru"] as const) {
          for (let repeat = 0; repeat < repeats; repeat++) {
            const row = lookup.get(`${id}/${language}/${repeat}`);
            if (!row) throw new Error("Missing paired response");
            scores[language].push(Number(row.correct));
            accuracy[language][repeat] =
              (accuracy[language][repeat] ?? 0) + Number(row.correct) / ids.length;
          }
        }
        return 100 * (mean(scores.en) - mean(scores.ru));
      });
      const random = seededRandom(seed);
      const bootstrap = Array.from({ length: samples }, () => {
        let sum = 0;
        for (let i = 0; i < ids.length; i++)
          sum += differences[Math.floor(random() * ids.length)] ?? 0;
        return sum / ids.length;
      }).sort((a, b) => a - b);
      const quantile = (p: number) => {
        const index = (bootstrap.length - 1) * p;
        const lo = bootstrap[Math.floor(index)];
        const hi = bootstrap[Math.ceil(index)];
        if (lo === undefined || hi === undefined)
          throw new Error("At least one bootstrap sample required");
        return lo + (hi - lo) * (index - Math.floor(index));
      };
      const averageCost = (language: ItemResult["language"]) => {
        const rows = group.filter((item) => item.language === language);
        if (rows.some((item) => item.costUsd === null)) return null;
        return rows.reduce((sum, item) => sum + (item.costUsd ?? 0), 0) / rows.length;
      };
      return aggregateSchema.parse({
        provider: first.provider,
        model: first.model,
        effort: first.effort,
        n: ids.length,
        repeats,
        en: Math.min(1, mean(accuracy.en)),
        ru: Math.min(1, mean(accuracy.ru)),
        gapPp: mean(differences),
        gapCi95: [quantile(0.025), quantile(0.975)],
        repeatAccuracy: accuracy,
        unparseable: group.filter((i) => i.outcome === "completed" && i.answer === null).length,
        refusals: group.filter((i) => i.outcome === "refusal").length,
        costUsd: group.some((i) => i.costUsd === null)
          ? null
          : group.reduce((sum, i) => sum + (i.costUsd ?? 0), 0),
        averageCostUsd: { en: averageCost("en"), ru: averageCost("ru") },
      });
    });
}

import type { Dictionary } from "@/i18n/routing";
import type en from "./en";
export default {
  description: "Результаты {model} на разных языках.",
  languageCount:
    "{count, plural, one {Проверен # язык} few {Проверено # языка} many {Проверено # языков} other {Проверено # языка}}",
  updated: "Обновлено",
  highest: "Лучший результат",
  lowest: "Самый низкий результат",
  languageGap: "Разница между языками",
  highestToLowest: "От лучшего к худшему",
  gapUnavailable: "Нет сопоставимого диапазона",
  pp: "п.п.",
  points: "балла",
  percentagePoints: "Процентные пункты",
  scorePoints: "Баллы оценки",
  moreLanguages: "ещё {count}",
  languageChart: "Результаты на каждом языке",
  chartDescription: "Средняя точность по доступным датасетам. Чем выше, тем лучше.",
  legacyDescription: "Опубликованная оценка из 100. Чем выше, тем лучше.",
  languageLabel: "Язык",
  accuracy: "Точность",
  score: "Оценка",
  searchLanguage: "Найти язык…",
  clearSearch: "Очистить поиск",
  noSearch: "По вашему запросу языков не нашлось.",
  missingScore: "Оценка пока не опубликована",
  noOverview: "Сводка для этого результата пока недоступна.",
  publishedResults: "Опубликованные результаты",
  chooseResult: "Выберите результат",
  seeExperiments: "Посмотреть эксперименты",
  historyCount:
    "{count, plural, one {# опубликованный эксперимент} few {# опубликованных эксперимента} many {# опубликованных экспериментов} other {# опубликованного эксперимента}}",
} as const satisfies Dictionary<typeof en>;

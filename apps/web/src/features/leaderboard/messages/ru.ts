import type { Dictionary } from "@/i18n/routing";
import type en from "./en";
export default {
  unspecifiedEffort: "Не указан",
  meanAccuracy: "Средняя точность, %",
  datasetCount:
    "{count, plural, one {# датасет} few {# датасета} many {# датасетов} other {# датасета}}",
  guideScore: "Балл / 100",
  incompleteScore:
    "Для сопоставимой оценки нужно больше результатов. Откройте страницу модели: там всё, что уже есть.",
  unmeasuredScore: "Сопоставимой оценки пока нет. На странице модели видно, что мы уже проверили.",
  scoreDetails: "Посмотреть результаты модели",
  baseline: "Базовая оценка",
  differencePp: "{value}п.п.",
  versusEnglish: "к английскому",
  differenceHelp:
    "Оценка языка минус оценка английского в процентных пунктах. Описательная разница оценок, а не проверка значимости.",
  selectAllLanguages: "Выбрать все",
  clearAllLanguages: "Сбросить все",
  clearLanguageSearch: "Очистить поиск языков",
  noMatchingLanguages: "Нет языков по вашему запросу",
  searchLanguages: "Найти язык…",

  noPublishedResults:
    "Мы ещё не опубликовали результаты. Пока можно почитать, как мы тестируем, или настроить свой запуск.",
  status: "Статус",
  languageFinderTitle: "Какой язык важен для вас?",
  languageFinderSearch: "Поиск языков…",
  languageFinderNavigationHelp: "Выберите язык, чтобы открыть его результаты.",
  languageFinderBrowse: "Открыть список языков",
  languageFinderNoResults: "Этого языка пока нет в списке.",
  languageFinderNoResultsHelp: "Попробуйте другое название или код языка.",
  finderTitle: "Есть модель на примете?",
  finderSearch: "Поиск моделей…",
  finderNavigationHelp: "Выберите модель, чтобы открыть её результаты.",
  finderBrowse: "Открыть список моделей",
  finderNoResults: "Этой модели пока нет в списке.",
  finderNoResultsHelp: "Попробуйте другое название модели или разработчика.",

  title: "Модель говорит на вашем языке. А отвечает правильно?",
  description:
    "Тестируем LLM на разных датасетах и языках. Публикуем оценки, промпты и ответы моделей. Неправильные — тоже.",
  tableTitle: "Как модели справились на каждом языке",
  tableDescription:
    "За каждой оценкой стоит опубликованный эксперимент. Откройте его: там видно, что и как мы проверяли.",
  model: "Модель",
  effort: "Уровень рассуждений",
  gap: "Разница",
  accuracy: "Точность",
  gapUnit: "Разница · п.п.",
  confidence: "95% интервал",
  planned: "В планах",
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  xhigh: "Очень высокий",
  max: "Максимальный",
  questions:
    "{count, plural, one {# уникальное задание} few {# уникальных задания} many {# уникальных заданий} other {# уникального задания}}",
  repeats: "{count, plural, one {# повтор} few {# повтора} many {# повторов} other {# повтора}}",
  languages:
    "{count, plural, one {# язык бенчмарка} few {# языка бенчмарка} other {# языков бенчмарка}}",
  sort: "Сортировать: {column}",
  searchModels: "Модель или разработчик…",
  filterEffort: "Фильтр по уровню рассуждений",
  allEfforts: "Все уровни рассуждений",
  resetFilters: "Сбросить фильтры",
  languageColumns: "Языки",
  compareModelsInLanguage: "Сравнить модели для языка «{language}»",
  alwaysShown: "Всегда показан",
  visibleLanguages: "Показано {count} из {total}",
  noResults: "Нет моделей с такими фильтрами",
  noResultsDescription:
    "Здесь пока пусто. Попробуйте другую модель, разработчика или уровень рассуждений.",
  neutral: "Интервал включает ноль: нельзя уверенно сказать, на каком языке точность выше.",
  release: "Выпуск {id}",
  metadataTitle: "Правильно ли LLM отвечает на вашем языке?",
  metadataPlannedDescription:
    "Мы делаем открытый бенчмарк точности LLM на разных датасетах и языках. Результатов пока нет. Почитайте, как мы тестируем, или настройте свой запуск.",
  metadataDescription:
    "Сравните точность LLM на разных датасетах и языках. Открытые оценки, промпты и ответы моделей. Найдите модель, которую стоит проверить на своих задачах.",
} as const satisfies Dictionary<typeof en>;

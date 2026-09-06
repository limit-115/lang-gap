import type { Dictionary } from "../../../i18n/routing";
import type en from "./en";
export default {
  navigation: "Навигация",
  resources: "Ресурсы",
  sourceCode: "Исходный код",
  documentation: "Документация",
  menu: "Открыть меню навигации",
  leaderboard: "Результаты",
  methodology: "Методика",
  releases: "Выпуски",
  language: "Сменить язык",
  skip: "Перейти к содержимому",
  tagline: "Язык имеет значение. Измеряем разницу.",
  footer: "Открытый бенчмарк языковых различий в LLM.",
  open: "Открытые код · методика · результаты",
  home: "Llang Gap — главная",
} as const satisfies Dictionary<typeof en>;

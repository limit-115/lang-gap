import type { Dictionary } from "@/i18n/routing";
import type en from "./en";

export default {
  metadataTitle: "Страница не найдена",
  title: "Вы нашли пробел.",
  description: "По этому адресу нет страницы.\nДавайте вернёмся к моделям.",
  compareModels: "Сравнить модели",
} as const satisfies Dictionary<typeof en>;

import type { Dictionary } from "@/i18n/routing";
import type en from "./en";

export default {
  externalSite: "Внешний сайт",
  opensNewTab: "Откроется в новой вкладке",
  downloadsFile: "Скачивание файла",
} as const satisfies Dictionary<typeof en>;

// Upstream identifiers belong to the pinned mmPISA adapter, not the benchmark.
// Match both name and code: several upstream codes are nonstandard or ambiguous.
export const mmpisaLanguages: Readonly<
  Record<string, { language: string; humanCode: string; machineCode: string }>
> = {
  Albanian: {
    language: "sq",
    humanCode: "sqi-ALB",
    machineCode: "sqi-ALB sq",
  },
  Arabic: {
    language: "ar",
    humanCode: "ara-ARE",
    machineCode: "ara-ARE ar",
  },
  "Azerbaijani / Azeri": {
    language: "az",
    humanCode: "aze-QAZ",
    machineCode: "aze-QAZ az",
  },
  Basque: {
    language: "eu",
    humanCode: "eus-ESP",
    machineCode: "eus-ESP eu",
  },
  Bokmål: {
    language: "nb",
    humanCode: "nob-NOR",
    machineCode: "nob-NOR nb",
  },
  Bosnian: {
    language: "bs",
    humanCode: "bos-BIH",
    machineCode: "bos-BIH bs",
  },
  Bulgarian: {
    language: "bg",
    humanCode: "bul-BGR",
    machineCode: "bul-BGR bg",
  },
  Catalan: {
    language: "ca",
    humanCode: "cat-ESP",
    machineCode: "cat-ESP ca",
  },
  Chinese: {
    language: "zh",
    humanCode: "zho-CHN",
    machineCode: "zho-CHN zh-CN",
  },
  Croatian: {
    language: "hr",
    humanCode: "hrv-HRV",
    machineCode: "hrv-HRV hr",
  },
  Czech: {
    language: "cs",
    humanCode: "ces-CZE",
    machineCode: "ces-CZE cs",
  },
  Danish: {
    language: "da",
    humanCode: "dan-DNK",
    machineCode: "dan-DNK da",
  },
  Dutch: {
    language: "nl",
    humanCode: "nld-NLD",
    machineCode: "nld-NLD nl",
  },
  English: {
    language: "en",
    humanCode: "eng-CAN",
    machineCode: "eng-CAN",
  },
  Estonian: {
    language: "et",
    humanCode: "est-EST",
    machineCode: "est-EST et",
  },
  Finnish: {
    language: "fi",
    humanCode: "fin-FIN",
    machineCode: "fin-FIN fi",
  },
  French: {
    language: "fr",
    humanCode: "fra-FRA",
    machineCode: "fra-FRA",
  },
  Galician: {
    language: "gl",
    humanCode: "glg-ESP",
    machineCode: "glg-ESP gl",
  },
  Georgian: {
    language: "ka",
    humanCode: "geo-GEO",
    machineCode: "geo-GEO ka",
  },
  German: {
    language: "de",
    humanCode: "deu-DEU",
    machineCode: "deu-DEU de",
  },
  Greek: {
    language: "el",
    humanCode: "ell-GRC",
    machineCode: "ell-GRC el",
  },
  Hebrew: {
    language: "he",
    humanCode: "heb-ISR",
    machineCode: "heb-ISR iw",
  },
  Hungarian: {
    language: "hu",
    humanCode: "hun-HUN",
    machineCode: "hun-HUN hu",
  },
  Icelandic: {
    language: "is",
    humanCode: "isl-ISL",
    machineCode: "isl-ISL is",
  },
  Indonesian: {
    language: "id",
    humanCode: "ind-IDN",
    machineCode: "ind-IDN id",
  },
  Italian: {
    language: "it",
    humanCode: "ita-ITA",
    machineCode: "ita-ITA it",
  },
  Japanese: {
    language: "ja",
    humanCode: "jpn-JPN",
    machineCode: "jpn-JPN ja",
  },
  Kazakh: {
    language: "kk",
    humanCode: "kaz-KAZ",
    machineCode: "kaz-KAZ kk",
  },
  Korean: {
    language: "ko",
    humanCode: "kor-KOR",
    machineCode: "kor-KOR ko",
  },
  Latvian: {
    language: "lv",
    humanCode: "lav-LVA",
    machineCode: "lav-LVA lv",
  },
  Lithuanian: {
    language: "lt",
    humanCode: "lit-LTU",
    machineCode: "lit-LTU lt",
  },
  Malay: {
    language: "ms",
    humanCode: "msa-MYS",
    machineCode: "msa-MYS ms",
  },
  Nynorsk: {
    language: "nn",
    humanCode: "nno-NOR",
    machineCode: "nno-NOR no",
  },
  Polish: {
    language: "pl",
    humanCode: "pol-POL",
    machineCode: "pol-POL pl",
  },
  Portuguese: {
    language: "pt",
    humanCode: "por-PRT",
    machineCode: "por-PRT pt",
  },
  Russian: {
    language: "ru",
    humanCode: "rus-KAZ",
    machineCode: "rus-KAZ ru",
  },
  "Serbian / Serb": {
    language: "sr",
    humanCode: "srp-SRB",
    machineCode: "srp-SRB sr",
  },
  Slovak: {
    language: "sk",
    humanCode: "slo-SVK",
    machineCode: "slo-SVK sk",
  },
  Slovenian: {
    language: "sl",
    humanCode: "slv-SVN",
    machineCode: "slv-SVN sl",
  },
  Spanish: {
    language: "es",
    humanCode: "esp-ESP",
    machineCode: "esp-ESP es",
  },
  Swedish: {
    language: "sv",
    humanCode: "swe-SWE",
    machineCode: "swe-SWE sv",
  },
  Thai: {
    language: "th",
    humanCode: "tha-THA",
    machineCode: "tha-THA th",
  },
  Turkish: {
    language: "tr",
    humanCode: "tur-TUR",
    machineCode: "tur-TUR tr",
  },
};

import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RunCta, type CtaPalette } from "./run-cta";
import styles from "./cta-palette-preview.module.css";

const palettes = ["graphite", "porcelain", "midnight", "aubergine", "mineral"] as const;

export async function CtaPalettePreview({ selected }: { selected: string | string[] }) {
  const t = await getTranslations("RunBuilder.palettes");
  if (typeof selected !== "string" || !["all", ...palettes].includes(selected)) return <RunCta />;
  const shown = selected === "all" ? palettes : [selected as CtaPalette];
  return (
    <div className={styles.preview} id="palettes">
      <div className={styles.header}>
        <h2>{t("title")}</h2>
        <nav aria-label={t("navigation")}>
          {(["all", ...palettes] as const).map((palette) => (
            <Link
              key={palette}
              href={`/?palette=${palette}#palettes`}
              aria-current={selected === palette ? "page" : undefined}
            >
              {t(palette)}
            </Link>
          ))}
        </nav>
      </div>
      <div className={styles.options}>
        {shown.map((palette) => (
          <div className={styles.option} key={palette}>
            <div className={styles.label}>
              <div>
                <h2>{t(palette)}</h2>
                <p>{t(`${palette}Note`)}</p>
              </div>
              {selected === "all" && (
                <Link href={`/?palette=${palette}#palettes`}>
                  {t("view")}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              )}
            </div>
            <RunCta palette={palette} id={`cta-${palette}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

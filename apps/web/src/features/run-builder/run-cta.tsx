import { ArrowRight, Terminal } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import styles from "./run-cta-spotlight.module.css";

export type CtaPalette = "graphite" | "porcelain" | "midnight" | "aubergine" | "mineral";

export async function RunCta({
  palette = "graphite",
  id = "own-run-title",
}: { palette?: CtaPalette; id?: string } = {}) {
  const t = await getTranslations("RunBuilder");
  return (
    <section className={styles.cta} data-palette={palette} aria-labelledby={id}>
      <h2 id={id}>
        <span>{t("ctaTitle")}</span>
        <span>{t("ctaTitleLanguages")}</span>
        <span className={styles.accent}>{t("ctaTitleBenchmark")}</span>
      </h2>
      <div className={styles.details}>
        <p>{t("ctaBody")}</p>
        <Link href="/run" className={buttonVariants({ className: styles.action })}>
          {t("ctaAction")}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
        <span className={styles.note}>
          <Terminal aria-hidden="true" className="size-4 shrink-0" />
          {t("ctaNote")}
        </span>
      </div>
    </section>
  );
}

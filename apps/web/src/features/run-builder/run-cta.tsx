import { Terminal } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/shared/links/link";
import styles from "./run-cta-spotlight.module.css";

export async function RunCta() {
  const t = await getTranslations("RunBuilder");
  return (
    <section id="run-cta" className={styles.cta} aria-labelledby="own-run-title">
      <h2 id="own-run-title">
        <span>{t("ctaTitle")}</span>
        <span>{t("ctaTitleLanguages")}</span>
        <span className={styles.accent}>{t("ctaTitleBenchmark")}</span>
      </h2>
      <div className={styles.details}>
        <p>{t("ctaBody")}</p>
      </div>
      <div className={styles.actions}>
        <ButtonLink href="/run" direction="forward" className={styles.action}>
          {t("ctaAction")}
        </ButtonLink>
        <span className={styles.note}>
          <Terminal aria-hidden="true" className="size-4 shrink-0" />
          {t("ctaNote")}
        </span>
      </div>
    </section>
  );
}

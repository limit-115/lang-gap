import type { Transport } from "@llang-gap/contracts";
import { FlaskConical } from "lucide-react";
import { ModelOwnerLogo } from "@/features/leaderboard/model-owner-logo";

export function ProviderLogo({ provider }: { provider: Transport }) {
  if (provider === "fake") return <FlaskConical aria-hidden="true" />;
  if (provider === "openrouter")
    return (
      <>
        <img
          src="/model-owners/openrouter.svg"
          alt=""
          width={24}
          height={18}
          className="dark:hidden"
        />
        <img
          src="/model-owners/openrouter-dark.svg"
          alt=""
          width={24}
          height={18}
          className="hidden dark:block"
        />
      </>
    );
  return <ModelOwnerLogo ownerId={provider} size={20} />;
}

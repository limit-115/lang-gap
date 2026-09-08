const ownerLogos = new Map([
  ["openai", "/model-owners/openai.svg"],
  ["anthropic", "/model-owners/anthropic.svg"],
]);

export function ModelOwnerLogo({ ownerId, size = 24 }: { ownerId: string | null; size?: number }) {
  const src = ownerId === null ? undefined : ownerLogos.get(ownerId);
  return src ? (
    <img src={src} width={size} height={size} alt="" className="shrink-0 dark:invert" />
  ) : null;
}

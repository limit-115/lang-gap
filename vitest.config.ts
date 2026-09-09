import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // Let Vite resolve next-intl's extensionless Next imports in Node tests.
    server: { deps: { inline: ["next-intl"] } },
    include: ["packages/**/*.test.ts", "apps/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**"],
    testTimeout: 20_000,
  },
});

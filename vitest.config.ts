import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    // Stale git worktrees live under .claude/worktrees and carry their own copies of the suite.
    exclude: ["**/node_modules/**", "**/.claude/**"],
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/ai-governance-assessment-framework-chatgpt-conversation/",
  build: { outDir: "docs", emptyOutDir: true },
});

import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { copyFile } from "node:fs/promises";
export default defineConfig({
  base: "./",
  plugins: [
    viteSingleFile(),
    {
      name: "moa-html-file",
      async closeBundle() {
        await copyFile("html/index.html", "코션.html");
      },
    },
  ],
  build: { outDir: "html", emptyOutDir: true, chunkSizeWarningLimit: 1600 },
});

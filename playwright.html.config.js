import { defineConfig } from "@playwright/test";
import path from "node:path";
import base from "./playwright.config.js";
process.env.MOA_HTML_FILE = path.resolve("모아.html");
export default defineConfig({
  ...base,
  webServer: undefined,
  use: { ...base.use, baseURL: undefined },
});

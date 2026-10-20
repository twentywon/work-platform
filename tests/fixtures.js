import { test as base, expect, _electron } from "@playwright/test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
export { expect };
const htmlSessions = new WeakMap();
export async function downloadTextFile(page, button) {
  const session = htmlSessions.get(page);
  if (session) {
    const savePath = path.join(session.profile, "download.txt");
    const completion = session.app.evaluate(
      ({ BrowserWindow }, target) =>
        new Promise((resolve) => {
          BrowserWindow.getAllWindows()[0].webContents.session.once(
            "will-download",
            (_event, item) => {
              item.setSavePath(target);
              item.once("done", (_event, state) =>
                resolve({ state, filename: item.getFilename() }),
              );
            },
          );
        }),
      savePath,
    );
    await button.click();
    const result = await completion;
    expect(result.state).toBe("completed");
    return {
      filename: result.filename,
      text: await readFile(savePath, "utf8"),
    };
  }
  const pending = page.waitForEvent("download");
  await button.click();
  const file = await pending;
  return {
    filename: file.suggestedFilename(),
    text: await readFile(await file.path(), "utf8"),
  };
}
export const test = process.env.MOA_HTML_FILE
  ? base.extend({
      page: async ({}, use) => {
        const profile = await mkdtemp(path.join(tmpdir(), "moa-html-"));
        const app = await _electron.launch({
          args: [
            ...(process.env.MOA_TEST_NO_SANDBOX ? ["--no-sandbox"] : []),
            "--disable-gpu",
            `--user-data-dir=${profile}`,
            path.resolve("tests/html-browser.cjs"),
          ],
        });
        try {
          const page = await app.firstWindow();
          htmlSessions.set(page, { app, profile });
          await use(page);
        } finally {
          await app.close();
          await rm(profile, { recursive: true, force: true });
        }
      },
    })
  : base;

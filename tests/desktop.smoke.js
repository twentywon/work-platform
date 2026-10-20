import { _electron, expect } from "@playwright/test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const temp = await mkdtemp(path.join(tmpdir(), "moa-desktop-"));
let app;
try {
  const fixture = path.join(temp, "native-document.txt");
  await writeFile(fixture, "원본 파일에서 읽은 업무 문서");
  app = await _electron.launch({
    args: [
      ...(process.env.MOA_TEST_NO_SANDBOX ? ["--no-sandbox"] : []),
      "--disable-gpu",
      `--user-data-dir=${path.join(temp, "profile")}`,
      ...(process.env.MOA_DESKTOP_EXECUTABLE ? [] : ["."]),
    ],
    executablePath: process.env.MOA_DESKTOP_EXECUTABLE || undefined,
    timeout: 20000,
  });
  const win = await app.firstWindow();
  await expect(win.locator("#canvas")).toBeVisible();
  await app.evaluate(({ dialog, shell }, filename) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [filename],
    });
    shell.openPath = async (filepath) => {
      globalThis.testOpenedFile = filepath;
      return "";
    };
  }, fixture);
  await win.locator(".toolbar [data-action=register]").click();
  const card = win
    .locator(".file-open")
    .filter({ hasText: "native-document.txt" });
  await expect(card).toBeVisible();
  await card.click();
  await expect
    .poll(() => app.evaluate(() => globalThis.testOpenedFile))
    .toBe(fixture);
  await win
    .locator(".block-file")
    .last()
    .locator("[data-preview-file]")
    .click();
  await expect(win.locator("#preview-body")).toContainText(
    "원본 파일에서 읽은 업무 문서",
  );
  const registeredFiles = await win.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const request = indexedDB.open("moa-workspace", 1);
      request.onsuccess = () => resolve(request.result);
    });
    return new Promise((resolve) => {
      const request = db.transaction("files").objectStore("files").getAll();
      request.onsuccess = () => resolve(request.result);
    });
  });
  expect(registeredFiles).toHaveLength(1);
  expect(registeredFiles[0].mode).toBe("desktop");
  expect(registeredFiles[0].path).toBe(fixture);
  expect(registeredFiles[0].file).toBeUndefined();
  const denial = await win.evaluate(async () => {
    try {
      await window.moaDesktop.readFile("/etc/passwd");
      return false;
    } catch {
      return true;
    }
  });
  expect(denial).toBe(true);
  await win.locator("#close-modal").click();
  await writeFile(fixture, "원본 파일의 수정된 최신 문서 내용");
  await win
    .locator(".block-file")
    .last()
    .locator("[data-preview-file]")
    .click();
  await expect(win.locator("#preview-body")).toContainText(
    "원본 파일의 수정된 최신 문서 내용",
  );
  await win.locator("#close-modal").click();
  await expect(win.locator("#save-status")).toContainText(
    "모든 변경사항 저장됨",
  );
  await app.evaluate(() => {
    globalThis.testOpenedFile = null;
  });
  await win.reload();
  await win
    .locator(".file-open")
    .filter({ hasText: "native-document.txt" })
    .click();
  await expect
    .poll(() => app.evaluate(() => globalThis.testOpenedFile))
    .toBe(fixture);
  const droppedFixture = path.join(temp, "dropped-original.txt");
  await writeFile(droppedFixture, "끌어 놓은 원본 문서");
  await win.locator("#file-input").setInputFiles(droppedFixture);
  const droppedCard = win
    .locator(".file-open")
    .filter({ hasText: "dropped-original.txt" });
  await expect(droppedCard).toBeVisible();
  await droppedCard.click();
  await expect
    .poll(() => app.evaluate(() => globalThis.testOpenedFile))
    .toBe(droppedFixture);
  await win.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(document.querySelector("#file-input").files[0]);
    document.querySelector("#viewport").dispatchEvent(new DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    }));
  });
  await expect(win.locator(".file-open").filter({hasText:"dropped-original.txt"})).toHaveCount(2);
  await app.evaluate(() => {globalThis.testOpenedFile = null;});
  await win.locator(".file-open").filter({hasText:"dropped-original.txt"}).last().click();
  await expect.poll(() => app.evaluate(() => globalThis.testOpenedFile)).toBe(droppedFixture);
  await win.locator('.sidebar [data-action="files"]').click();
  await app.evaluate(() => {
    globalThis.testOpenedFile = null;
  });
  await win
    .locator(".library-file")
    .filter({ hasText: "native-document.txt" })
    .click();
  await expect
    .poll(() => app.evaluate(() => globalThis.testOpenedFile))
    .toBe(fixture);
  console.log(
    "PASS: Electron startup, native file registration, native-open handoff, live source preview, reload persistence, unregistered-path denial.",
  );
} finally {
  if (app) await app.close();
  await rm(temp, { recursive: true, force: true });
}

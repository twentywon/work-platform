import { pathToFileURL } from "node:url";
import { test, expect, downloadTextFile } from "./fixtures.js";
import JSZip from "jszip";
import * as XLSX from "xlsx";
async function upload(
  page,
  name,
  buffer,
  mimeType = "application/octet-stream",
) {
  await page.locator("#file-input").setInputFiles({
    name,
    mimeType,
    buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
  });
  await expect(
    page.locator(".file-open").filter({ hasText: name }),
  ).toBeVisible();
  await page.locator(".file-open").filter({ hasText: name }).click();
}
test.beforeEach(async ({ page }) => {
  await page.goto(
    process.env.MOA_HTML_FILE
      ? pathToFileURL(process.env.MOA_HTML_FILE).href
      : "/",
  );
  await expect(page.locator("#canvas")).toBeVisible();
});
test("edits persist, fixed page sizes and numeric pagination work", async ({
  page,
}) => {
  await page.locator("[data-add=note]").click();
  const note = page.locator(".block-note").last().locator(".editable");
  await note.fill("업무 회의: 금요일 오후 3시");
  await expect(page.locator("#save-status")).toContainText(
    "모든 변경사항 저장됨",
  );
  await page.reload();
  await expect(
    page.getByText("업무 회의: 금요일 오후 3시", { exact: true }),
  ).toBeVisible();
  await page.locator(".pagination [data-action=add-page]").click();
  await expect(page.locator(".page-count")).toHaveText("2 / 2 페이지");
  const dimensions = await page
    .locator("#canvas")
    .evaluate((el) => [el.style.width, el.style.height]);
  await page.setViewportSize({ width: 1050, height: 800 });
  expect(
    await page
      .locator("#canvas")
      .evaluate((el) => [el.style.width, el.style.height]),
  ).toEqual(dimensions);
  await page.locator("#page-title").fill("두 번째 프로젝트");
  await page.locator("#page-title").press("Tab");
  await page.locator("[data-add=text]").click();
  await expect(page.locator(".block-text")).toHaveCount(1);
  await page.locator('.pagination [aria-label="1페이지"]').click();
  await expect(page.locator("#page-title")).toHaveValue("우리의 새로운 시작");
  await page.locator('.pagination [aria-label="2페이지"]').click();
  await expect(page.locator("#page-title")).toHaveValue("두 번째 프로젝트");
});
test("table, shapes, both dividers, movement, resizing and deletion", async ({
  page,
}) => {
  await page.locator("[data-add=table]").click();
  await page.locator(".block-table td").first().fill("요구사항 정리");
  await page.locator("[data-block-action=row]").click();
  await expect(page.locator(".block-table tr")).toHaveCount(5);
  await page.locator("[data-block-action=column]").click();
  await expect(page.locator(".block-table th")).toHaveCount(4);
  await page.locator("[data-menu=shapes]").click();
  await page.locator("[data-add=circle]").click();
  await expect(page.locator(".block-circle")).toBeVisible();
  await page.locator("[data-menu=lines]").click();
  await page.locator("[data-add=vline]").click();
  await expect(page.locator(".block-vline")).toHaveCount(1);
  await page.locator("[data-menu=lines]").click();
  await page.locator("[data-add=hline]").click();
  await expect(page.locator(".block-hline")).toHaveCount(2);
  const block = page.locator(".block-hline").last();
  const original = await block.evaluate((el) => ({
    x: parseFloat(el.style.left),
    w: parseFloat(el.style.width),
  }));
  let handle = await block.locator(".drag-handle").boundingBox();
  await page.mouse.move(handle.x + 10, handle.y + 10);
  await page.mouse.down();
  await page.mouse.move(handle.x + 100, handle.y + 60, { steps: 5 });
  await page.mouse.up();
  expect(
    await block.evaluate((el) => parseFloat(el.style.left)),
  ).toBeGreaterThan(original.x);
  handle = await block.locator(".resize-handle").boundingBox();
  await page.mouse.move(handle.x + 4, handle.y + 4);
  await page.mouse.down();
  await page.mouse.move(handle.x + 45, handle.y + 4, { steps: 5 });
  await page.mouse.up();
  expect(
    await block.evaluate((el) => parseFloat(el.style.width)),
  ).toBeGreaterThan(original.w);
  await page.locator("[data-block-action=delete]").click();
  await expect(page.locator(".block-hline")).toHaveCount(1);
});
test("file preview, hover, download and persisted upload", async ({ page }) => {
  await upload(
    page,
    "meeting.txt",
    "실제 파일 내용: 다음 주 회의",
    "text/plain",
  );
  await expect(page.locator("#preview-body")).toContainText(
    "실제 파일 내용: 다음 주 회의",
  );
  const download = await downloadTextFile(page, page.locator("#download-file"));
  expect(download.filename).toBe("meeting.txt");
  expect(download.text).toBe("실제 파일 내용: 다음 주 회의");
  await page.locator("#close-modal").click();
  await expect(page.locator("#save-status")).toContainText(
    "모든 변경사항 저장됨",
  );
  await page.reload();
  const file = page.locator(".file-open").filter({ hasText: "meeting.txt" });
  await file.hover();
  await expect(page.locator("#hover-preview")).toContainText(
    "실제 파일 내용: 다음 주 회의",
  );
  await file.click();
  await expect(page.locator("#preview-body")).toContainText(
    "실제 파일 내용: 다음 주 회의",
  );
});
test("Office and HWPX preview actual file contents", async ({ page }) => {
  const doc = new JSZip();
  doc.file(
    "[Content_Types].xml",
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  doc.file(
    "_rels/.rels",
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  doc.file(
    "word/document.xml",
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Word 실제 본문</w:t></w:r></w:p></w:body></w:document>',
  );
  await upload(
    page,
    "report.docx",
    await doc.generateAsync({ type: "nodebuffer" }),
  );
  await expect(page.locator("#preview-body")).toContainText("Word 실제 본문");
  await page.locator("#close-modal").click();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["항목", "금액"],
      ["회의비", 45000],
    ]),
    "예산",
  );
  await upload(
    page,
    "budget.xlsx",
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }),
  );
  await expect(page.locator("#preview-body")).toContainText("회의비");
  await expect(page.locator("#preview-body")).toContainText("45000");
  await page.locator("#close-modal").click();
  for (const [name, path, xml, expected] of [
    [
      "slides.pptx",
      "ppt/slides/slide1.xml",
      '<p:sld xmlns:p="urn:p" xmlns:a="urn:a"><a:t>발표의 핵심</a:t></p:sld>',
      "발표의 핵심",
    ],
    [
      "document.hwpx",
      "Contents/section0.xml",
      '<hs:sec xmlns:hs="urn:hs" xmlns:hp="urn:hp"><hp:t>한글 문서 본문</hp:t></hs:sec>',
      "한글 문서 본문",
    ],
  ]) {
    const zip = new JSZip();
    zip.file(path, xml);
    await upload(page, name, await zip.generateAsync({ type: "nodebuffer" }));
    await expect(page.locator("#preview-body")).toContainText(expected);
    await page.locator("#close-modal").click();
  }
  await upload(page, "legacy.hwp", "legacy contents");
  await expect(page.locator("#preview-body")).toContainText(
    "미리보기를 지원하지 않습니다",
  );
});
test("image preview, page dimensions and mobile layout", async ({ page }) => {
  await upload(
    page,
    "sample.svg",
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="green"/></svg>',
    "image/svg+xml",
  );
  await expect(page.locator(".preview-image")).toBeVisible();
  expect(
    await page
      .locator(".preview-image")
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
  await page.locator("#close-modal").click();
  await page.locator("[data-action=dimensions]").click();
  await page.locator("[name=width]").fill("1600");
  await page.locator("[name=height]").fill("900");
  await page.getByRole("button", { name: "크기 적용", exact: true }).click();
  await expect(page.locator("#canvas")).toHaveCSS("width", "1600px");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-add=note]")).toBeVisible();
  await expect(page.locator(".pagination")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
test("browser linked file reads latest source after changes", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const dir = await navigator.storage.getDirectory();
    const handle = await dir.getFileHandle("linked.txt", { create: true });
    let writer = await handle.createWritable();
    await writer.write("원본 파일 첫 번째 내용");
    await writer.close();
    window.showOpenFilePicker = async () => [handle];
  });
  await page.locator(".page-header [data-action=register]").click();
  const card = page.locator(".file-open").filter({ hasText: "linked.txt" });
  await card.click();
  await expect(page.locator("#preview-body")).toContainText(
    "원본 파일 첫 번째 내용",
  );
  await page.locator("#close-modal").click();
  await page.evaluate(async () => {
    const dir = await navigator.storage.getDirectory();
    const handle = await dir.getFileHandle("linked.txt");
    const writer = await handle.createWritable();
    await writer.write("원본에서 수정한 새로운 최신 내용");
    await writer.close();
  });
  await card.click();
  await expect(page.locator("#preview-body")).toContainText(
    "원본에서 수정한 새로운 최신 내용",
  );
  await page.locator("#close-modal").click();
  await expect(page.locator("#save-status")).toContainText(
    "모든 변경사항 저장됨",
  );
  await page.reload();
  await page.locator(".file-open").filter({ hasText: "linked.txt" }).click();
  await expect(page.locator("#preview-body")).toContainText(
    "원본에서 수정한 새로운 최신 내용",
  );
});
test("desktop bridge registers original paths, opens native files and previews separately", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.nativeOpened = [];
    window.moaDesktop = {
      pickFiles: async () => [
        {
          id: "native-123",
          name: "desktop.txt",
          path: "/Documents/desktop.txt",
        },
      ],
      openFile: async (id) => window.nativeOpened.push(id),
      readFile: async () => ({
        name: "desktop.txt",
        lastModified: 123456,
        bytes: new TextEncoder().encode("데스크톱 원본 파일 미리보기"),
      }),
    };
  });
  await page.locator(".page-header [data-action=register]").click();
  await page.locator(".file-open").filter({ hasText: "desktop.txt" }).click();
  expect(await page.evaluate(() => window.nativeOpened)).toEqual([
    "native-123",
  ]);
  await expect(page.locator(".modal")).toHaveCount(0);
  await page
    .locator(".block-file")
    .last()
    .locator("[data-preview-file]")
    .click();
  await expect(page.locator("#preview-body")).toContainText(
    "데스크톱 원본 파일 미리보기",
  );
  await expect(page.locator(".preview-info")).toContainText(
    "/Documents/desktop.txt",
  );
});
test("PDF file is passed intact to the document viewer", async ({ page }) => {
  const stream = "BT /F1 12 Tf 20 100 Td (Moa PDF preview) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n",
    offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n ")
    .join(
      "\n",
    )}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  await upload(page, "document.pdf", pdf, "application/pdf");
  await expect(page.locator(".pdf-frame")).toBeVisible();
  const source = await page.locator(".pdf-frame").getAttribute("src");
  expect(source).toMatch(/^blob:/);
  expect(
    await page.evaluate(
      async (url) => (await (await fetch(url)).text()).startsWith("%PDF-1.4"),
      source,
    ),
  ).toBe(true);
});

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
  await page.locator(".toolbar [data-action=register]").click();
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
  await page.locator(".toolbar [data-action=register]").click();
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

test('board fills the width, title panel is removed, rotation persists and movement snaps', async ({page}) => {
  await expect(page.locator('.page-header')).toHaveCount(0);
  const size = await page.locator('#canvas').evaluate(el => {
    const v=document.querySelector('#viewport');
    return {width:el.getBoundingClientRect().width,available:v.clientWidth-24};
  });
  expect(Math.abs(size.width-size.available)).toBeLessThan(2);
  await page.setViewportSize({width:1440,height:640});
  await expect.poll(()=>page.locator('#canvas').evaluate(el=>Math.abs(el.getBoundingClientRect().width-(document.querySelector('#viewport').clientWidth-24)))).toBeLessThan(2);
  await page.locator('[data-menu=shapes]').click();
  await page.locator('[data-add=rect]').click();
  const block=page.locator('.block-rect').last();
  const id=await block.getAttribute('data-id');
  await page.locator('#rotation-angle').fill('30');
  await page.locator('#rotation-angle').press('Tab');
  await expect(block).toHaveCSS('transform',/matrix/);
  await page.locator('[data-block-action=rotate]').click();
  await expect(page.locator('#rotation-angle')).toHaveValue('120');
  await expect(page.locator('#save-status')).toContainText('모든 변경사항 저장됨');
  await page.reload();
  const restored=page.locator(`[data-id="${id}"]`);
  expect(await restored.getAttribute('style')).toContain('rotate(120deg)');
  await restored.click();
  await page.locator('#rotation-angle').fill('0');
  await page.locator('#rotation-angle').press('Tab');
  await restored.locator('.drag-handle').scrollIntoViewIfNeeded();
  let handle=await restored.locator('.drag-handle').boundingBox();
  await page.mouse.move(handle.x+10,handle.y+10);await page.mouse.down();
  await page.mouse.move(handle.x+83,handle.y+57,{steps:5});await page.mouse.up();
  const coords=await restored.evaluate(el=>[parseFloat(el.style.left),parseFloat(el.style.top)]);
  expect(coords[0]%20).toBe(0);expect(coords[1]%20).toBe(0);
  handle=await restored.locator('.rotate-handle').boundingBox();
  const rect=await restored.boundingBox();
  const center={x:rect.x+rect.width/2,y:rect.y+rect.height/2};
  const start={x:handle.x+12,y:handle.y+12};
  const dx=start.x-center.x,dy=start.y-center.y;
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  await page.mouse.move(center.x+dx*Math.SQRT1_2-dy*Math.SQRT1_2,center.y+dx*Math.SQRT1_2+dy*Math.SQRT1_2,{steps:8});
  await page.mouse.up();
  await expect(page.locator('#rotation-angle')).toHaveValue('45');
});

async function insertExtra(page, action) {
  await page.locator('[data-menu=extras]').click();
  await page.locator(action).click();
}
test('checkboxes, web links and page links persist and navigate', async ({page}) => {
  await expect(page.locator('.canvas-meta')).toHaveCount(0);
  await page.locator('[data-add=checkbox]').click();
  const task=page.locator('.block-checkbox');
  await task.locator('.editable').fill('계약서 확인');
  await task.getByRole('checkbox').check();
  await expect(task.locator('.check-item')).toHaveClass(/done/);
  await insertExtra(page,'[data-action=web]');
  await page.locator('[name=url]').fill('javascript:alert(1)');
  await page.locator('#link-form [type=submit]').click();
  await expect(page.locator('#link-error')).toContainText('http');
  await page.locator('[name=url]').fill('example.com/team');
  await page.locator('[name=label]').fill('팀 홈페이지');
  await page.locator('#link-form [type=submit]').click();
  await expect(page.locator('.block-web a')).toHaveAttribute('href','https://example.com/team');
  await expect(page.locator('.block-web a')).toHaveAttribute('rel','noopener noreferrer');
  await page.locator('.pagination [data-action=add-page]').click();
  await page.locator('#page-title').fill('프로젝트 자료');
  await page.locator('#page-title').press('Tab');
  await page.locator('.pagination [aria-label="1페이지"]').click();
  await insertExtra(page,'[data-action=pagelink]');
  await page.locator('[name=target]').selectOption({label:'프로젝트 자료'});
  await page.locator('#link-form [type=submit]').click();
  await expect(page.locator('.block-pagelink')).toContainText('프로젝트 자료');
  await expect(page.locator('#save-status')).toContainText('모든 변경사항 저장됨');
  await page.reload();
  await expect(page.locator('.block-checkbox .editable')).toHaveText('계약서 확인');
  await expect(page.locator('.block-checkbox input[type=checkbox]')).toBeChecked();
  await expect(page.locator('.block-web a')).toContainText('팀 홈페이지');
  await page.locator('[data-board-page]').click();
  await expect(page.locator('#page-title')).toHaveValue('프로젝트 자료');
});
test('calendar month navigation and editable date notes survive reload', async ({page}) => {
  await insertExtra(page,'[data-add=calendar]');
  const calendar=page.locator('.block-calendar');
  await calendar.locator('[data-calendar-month]').fill('2024-02');
  await calendar.locator('[data-calendar-month]').press('Tab');
  await expect(calendar.locator('[data-calendar-date]')).toHaveCount(29);
  await calendar.locator('[data-calendar-date="2024-02-29"]').click();
  await page.locator('[name=event]').fill('월말 보고서 제출');
  await page.locator('#event-form [type=submit]').click();
  await expect(calendar.locator('[data-calendar-date="2024-02-29"]')).toContainText('월말 보고서 제출');
  await calendar.locator('[data-calendar-step="1"]').click();
  await expect(calendar.locator('[data-calendar-month]')).toHaveValue('2024-03');
  await calendar.locator('[data-calendar-step="-1"]').click();
  await expect(page.locator('#save-status')).toContainText('모든 변경사항 저장됨');
  await page.reload();
  await page.locator('[data-calendar-date="2024-02-29"]').click();
  await expect(page.locator('[name=event]')).toHaveValue('월말 보고서 제출');
  await page.locator('#delete-event').click();
  await expect(page.locator('[data-calendar-date="2024-02-29"]')).not.toHaveClass(/has-event/);
});
test('image, animated GIF and real video embed in the board and restore from storage', async ({page}) => {
  const {readFile} = await import('node:fs/promises');
  for(const media of [
    {name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jUQAAAABJRU5ErkJggg==','base64')},
    {name:'motion.gif',mimeType:'image/gif',buffer:await readFile('tests/fixtures/motion.gif')},
    {name:'clip.webm',mimeType:'video/webm',buffer:await readFile('tests/fixtures/clip.webm')},
  ]) {
    await page.locator('#media-input').setInputFiles(media);
    await expect(page.locator('.media-caption').filter({hasText:media.name})).toBeVisible();
  }
  await expect.poll(()=>page.locator('.media-content img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
  const video=page.locator('.media-content video');
  await expect.poll(()=>video.evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(1);
  await video.evaluate(v=>v.play());
  await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(0);
  await expect(page.locator('#save-status')).toContainText('모든 변경사항 저장됨');
  await page.reload();
  await expect(page.locator('.block-media')).toHaveCount(3);
  await expect.poll(()=>page.locator('.media-content img').evaluateAll(imgs=>imgs.length===2&&imgs.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
  await expect.poll(()=>page.locator('.media-content video').evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(1);
});

test('native selection shows waiting, cancellation and persistent connection errors', async ({page}) => {
  await page.evaluate(()=>{
    window.pickCount=0;
    window.moaDesktop={
      pickFiles:()=>{window.pickCount++;return new Promise(resolve=>window.finishPick=resolve)},
      chooseFolder:async()=>{throw Error('도우미 연결 오류: 테스트')},
    };
  });
  await page.locator('.toolbar [data-action=register]').click();
  await expect(page.locator('#native-picker-wait')).toContainText('Windows 파일 선택 창');
  await page.evaluate(()=>window.finishPick([]));
  await expect(page.locator('.modal')).toHaveCount(0);
  await expect(page.locator('#toast')).toContainText('선택을 취소');
  await page.locator('[data-action=link-folder]').click();
  await expect(page.locator('#connection-detail')).toContainText('도우미 연결 오류: 테스트');
  await expect(page.locator('.modal')).toContainText('모아 실행.cmd');
  expect(await page.evaluate(()=>window.pickCount)).toBe(1);
});
test('browser-only folder button explains how to activate original shortcuts', async ({page}) => {
  await page.locator('[data-action=link-folder]').click();
  await expect(page.locator('#connection-detail')).toContainText('미리보기 모드');
  await expect(page.locator('.modal')).toContainText('http://127.0.0.1:17843');
});

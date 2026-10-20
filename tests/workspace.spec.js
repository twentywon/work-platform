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
  await page.evaluate(()=>window.moaDesktop.pickFiles=async()=>{throw Error('도우미 연결 오류: 테스트')});
  await page.locator('.toolbar [data-action=register]').click();
  await expect(page.locator('#connection-detail')).toContainText('도우미 연결 오류: 테스트');
  await expect(page.locator('.modal')).toContainText('코션 실행.vbs');
  expect(await page.evaluate(()=>window.pickCount)).toBe(1);
});
test('browser-only path button explains how to activate original shortcuts', async ({page}) => {
  await page.locator('[data-action=path-shortcut]').click();
  await expect(page.locator('#connection-detail')).toContainText('미리보기 모드');
  await expect(page.locator('.modal')).toContainText('http://127.0.0.1:17843');
});

test('PDF hover renders the actual first page as an image', async ({page}) => {
  const {readFile} = await import('node:fs/promises');
  await page.locator('#file-input').setInputFiles({name:'first-page.pdf',mimeType:'application/pdf',buffer:await readFile('tests/fixtures/first-page.pdf')});
  const card=page.locator('.file-open').filter({hasText:'first-page.pdf'});
  await card.hover();
  const image=page.locator('#hover-preview img[alt="PDF 첫 페이지 이미지"]');
  await expect(image).toBeVisible();
  await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
  const pixel=await image.evaluate(i=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);return [...x.getImageData(20,20,1,1).data]});
  expect(pixel[0]).toBeGreaterThan(240);expect(pixel[1]).toBeLessThan(20);
});
test('HWP and HWPX use stored first-page images rather than text substitutes', async ({page}) => {
  const {readFile}=await import('node:fs/promises');
  const CFB=await import('cfb');
  const png=await readFile('tests/fixtures/first-page.png');
  const hwp=CFB.utils.cfb_new();CFB.utils.cfb_add(hwp,'PrvImage',png);
  const hwpx=new JSZip();hwpx.file('Preview/PrvImage.png',png);
  for(const [name,buffer] of [['first.hwp',CFB.write(hwp,{type:'buffer'})],['first.hwpx',await hwpx.generateAsync({type:'nodebuffer'})]]) {
    await upload(page,name,buffer);
    const image=page.locator('#preview-body .page-preview');
    await expect(image).toBeVisible();
    await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth)).toBe(120);
    await expect(page.locator('#preview-body')).toContainText('저장된 첫 페이지 이미지');
    await page.locator('#close-modal').click();
  }
});

test('object borders select file cards without opening them',async({page})=>{
 await page.evaluate(()=>{
  window.edgeOpened=[];
  window.moaDesktop={pickFiles:async()=>[{id:'edge-file',name:'border.txt',path:'C:/Docs/border.txt'}],openFile:async id=>window.edgeOpened.push(id)};
 });
 await page.locator('.toolbar [data-action=register]').click();
 const block=page.locator('.block-file').filter({hasText:'border.txt'});
 await page.locator('#canvas').click({position:{x:10,y:10}});
 await block.locator('.edge-right').click();
 await expect(block).toHaveClass(/selected/);expect(await page.evaluate(()=>window.edgeOpened)).toEqual([]);
 await block.locator('.edge-left').focus();
 await page.keyboard.press('Delete');await expect(block).toHaveCount(0);
});
test('drawer contains mixed objects, toggles, persists and extracts members',async({page})=>{
 const {readFile}=await import('node:fs/promises');
 await page.locator('#file-input').setInputFiles({name:'inside.txt',mimeType:'text/plain',buffer:Buffer.from('서랍 속 파일 내용')});
 await page.locator('#media-input').setInputFiles({name:'motion.gif',mimeType:'image/gif',buffer:await readFile('tests/fixtures/motion.gif')});
 await page.locator('[data-add=drawer]').click();
 const drawer=page.locator('.block-drawer');
 await drawer.locator('[data-drawer-name]').fill('프로젝트 서랍');
 await drawer.locator('[data-drawer-toggle]').click();
 await drawer.locator('[data-drawer-existing]').click();
 await page.locator('.drawer-choice').filter({hasText:'inside.txt'}).locator('input').check();
 await page.locator('.drawer-choice').filter({hasText:'motion.gif'}).locator('input').check();
 await page.locator('#drawer-form [type=submit]').click();
 await expect(drawer.locator('.drawer-entry')).toHaveCount(2);
 await expect(drawer.locator('img')).toBeVisible();
 await drawer.locator('[data-drawer-check]').click();
 await drawer.locator('.block-checkbox .editable').fill('서랍 안 할 일');
 await drawer.locator('.block-checkbox input').check();
 await drawer.locator('[data-drawer-toggle]').click();
 await expect(drawer.locator('.drawer-list')).toHaveCount(0);
 await expect(page.locator('#save-status')).toContainText('모든 변경사항 저장됨');
 await page.reload();
 await expect(page.locator('[data-drawer-name]')).toHaveValue('프로젝트 서랍');
 await expect(page.locator('.drawer-list')).toHaveCount(0);
 await page.locator('[data-drawer-toggle]').click();
 await expect(page.locator('.block-drawer .drawer-entry')).toHaveCount(3);
 await expect(page.locator('.block-drawer .block-checkbox input')).toBeChecked();
 const entry=page.locator('.drawer-entry').filter({has:page.locator('.file-open')});
 await entry.locator('[data-drawer-out]').click();
 await expect(page.locator('.block-drawer .drawer-entry')).toHaveCount(2);
 const card=page.locator('.file-open').filter({hasText:'inside.txt'});
 expect(await card.evaluate(el=>!!el.closest('.drawer-list'))).toBe(false);
 await card.click();await expect(page.locator('#preview-body')).toContainText('서랍 속 파일 내용');
});

test('workspace backup restores media, drawer contents and text after replacement',async({page})=>{
 const {readFile}=await import('node:fs/promises');
 await page.locator('#media-input').setInputFiles({name:'backup.gif',mimeType:'image/gif',buffer:await readFile('tests/fixtures/motion.gif')});
 await page.locator('[data-add=drawer]').click();
 await page.locator('[data-drawer-toggle]').click();
 await page.locator('[data-drawer-existing]').click();
 await page.locator('.drawer-choice').filter({hasText:'backup.gif'}).locator('input').check();
 await page.locator('#drawer-form [type=submit]').click();
 await page.locator('[data-drawer-note]').click();
 await page.locator('.in-drawer .editable').fill('옮겨온 보드');
 await page.locator('[data-action=backup-menu]').click();
 const backup=await downloadTextFile(page,page.locator('#export-backup'));
 expect(backup.filename).toBe('Cotion-workspace-backup.json');
 await page.locator('#close-modal').click();
 await page.locator('[data-add=checkbox]').click();
 await page.locator('#backup-input').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(backup.text)});
 await expect(page.locator('.block-checkbox')).toHaveCount(0);
 await expect(page.locator('.drawer-entry')).toHaveCount(2);
 await expect(page.locator('.in-drawer .editable')).toHaveText('옮겨온 보드');
 await expect.poll(()=>page.locator('.block-media img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
 await page.reload();
 await expect(page.locator('.in-drawer .editable')).toHaveText('옮겨온 보드');
 await expect.poll(()=>page.locator('.block-media img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
});

test('fractional display density keeps board width, zoom, editing and drag coordinates correct',async({page})=>{
 const cdp=await page.context().newCDPSession(page);
 const initial=await page.locator('#canvas').evaluate(el=>({width:el.style.width,height:el.style.height}));
 try {
  for(const density of [1.25,1.5,2]) {
   await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:density,mobile:false});
   await expect.poll(()=>page.evaluate(()=>window.devicePixelRatio)).toBe(density);
   await page.locator('#zoom-value').click();
   await expect.poll(()=>page.locator('#canvas').evaluate(el=>Math.abs(el.getBoundingClientRect().width-(document.querySelector('#viewport').clientWidth-24)))).toBeLessThan(2);
   await page.locator('[data-add=note]').click();
   const note=page.locator('.block-note').last();
   await note.locator('.editable').fill(`선명한 글자 ${density}`);
   await page.locator('[data-action=actual-size]').click();
   await expect(page.locator('#zoom-value')).toHaveText('100%');
   expect(await page.locator('#canvas').evaluate(el=>el.getBoundingClientRect().width)).toBeCloseTo(parseFloat(initial.width),0);
   await page.locator('#zoom-value').click();
   const zoom=await page.locator('#canvas').evaluate(el=>Number(getComputedStyle(el).zoom));
   const before=await note.evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top)}));
   await note.locator('.drag-handle').scrollIntoViewIfNeeded();
   const handle=await note.locator('.drag-handle').boundingBox();
   await page.mouse.move(handle.x+8,handle.y+8);await page.mouse.down();
   await page.mouse.move(handle.x+8+60*zoom,handle.y+8+40*zoom,{steps:5});await page.mouse.up();
   const after=await note.evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top)}));
   expect(after.x-before.x).toBe(60);expect(after.y-before.y).toBe(40);
   await expect(note.locator('.editable')).toHaveText(`선명한 글자 ${density}`);
   expect(await page.locator('#canvas').evaluate(el=>({width:el.style.width,height:el.style.height}))).toEqual(initial);
  }
  // Readability of actual note text and toolbar labels, not just decorative colors.
  const ratio=await page.locator('.block-note').last().evaluate(el=>{
   const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};
   const fg=luminance(getComputedStyle(el.querySelector('.editable')).color),bg=luminance(getComputedStyle(el).backgroundColor);
   return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
 } finally {await cdp.send('Emulation.clearDeviceMetricsOverride');await cdp.detach();}
});

async function seedInteractionBoard(page,blocks) {
 await page.evaluate(async blocks=>{
  const db=await new Promise(resolve=>{const r=indexedDB.open('moa-workspace',1);r.onsuccess=()=>resolve(r.result)});
  const state=await new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('workspace');r.onsuccess=()=>resolve(r.result)});
  state.pages=state.pages.filter(p=>p.id===state.active);
  state.pages[0].blocks=blocks.map(b=>({w:180,h:100,rotation:0,color:'#fff4ce',text:b.id,...b}));
  await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(state,'workspace');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
 },blocks);
 await page.reload();await expect(page.locator('#canvas')).toBeVisible();
}
async function boardCoordinates(page,x,y) {
 return page.locator('#canvas').evaluate((el,{x,y})=>{const r=el.getBoundingClientRect(),z=r.width/parseFloat(el.style.width);return {x:r.x+x*z,y:r.y+y*z,z};},{x,y});
}
async function editSetting(page,prop,value) {
 const input=page.locator(`[data-prop="${prop}"]`);await input.fill(String(value));await input.press('Tab');
}
test('marquee, additive selection and group drag preserve relative placement',async({page})=>{
 await seedInteractionBoard(page,[{id:'a',type:'note',x:100,y:100,rotation:15},{id:'b',type:'note',x:400,y:130},{id:'c',type:'checkbox',x:800,y:120,h:60}]);
 const start=await boardCoordinates(page,40,40),end=await boardCoordinates(page,650,280);
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});
 await expect(page.locator('.block.selected')).toHaveCount(2);await page.mouse.up();
 await expect(page.locator('#selection-tools strong')).toHaveText('2개 선택');
 await page.locator('[data-id=c] .edge-bottom').click({modifiers:['Shift']});await expect(page.locator('.block.selected')).toHaveCount(3);
 await page.locator('[data-id=c] .edge-bottom').click({modifiers:['Shift']});await expect(page.locator('.block.selected')).toHaveCount(2);
 const grip=await page.locator('[data-id=b] > .drag-handle').boundingBox();
 await page.mouse.move(grip.x+5,grip.y+5);await page.mouse.down();await page.mouse.move(grip.x+5+60*start.z,grip.y+5+40*start.z,{steps:6});await page.mouse.up();
 expect(await page.locator('[data-id=a]').evaluate(el=>[parseFloat(el.style.left),parseFloat(el.style.top)])).toEqual([160,140]);
 expect(await page.locator('[data-id=b]').evaluate(el=>[parseFloat(el.style.left),parseFloat(el.style.top)])).toEqual([460,170]);
 await page.locator('[data-block-action=align-left]').click();
 expect(await page.locator('[data-id=b]').evaluate(el=>parseFloat(el.style.left))).toBeLessThan(200);
 await page.locator('#canvas').focus();await page.keyboard.press('Delete');await expect(page.locator('.block')).toHaveCount(1);
 await page.keyboard.press('Control+z');await expect(page.locator('.block')).toHaveCount(3);
});
test('existing selected objects drop into a collapsed drawer and persist',async({page})=>{
 await seedInteractionBoard(page,[{id:'a',type:'note',x:100,y:100},{id:'b',type:'checkbox',x:120,y:260,h:60},{id:'d',type:'drawer',name:'자료 서랍',x:700,y:100,w:380,h:60}]);
 await page.locator('[data-id=a] .edge-left').click();await page.locator('[data-id=b] .edge-bottom').click({modifiers:['Shift']});
 const grip=await page.locator('[data-id=a] > .drag-handle').boundingBox(),dest=await boardCoordinates(page,750,130);
 await page.mouse.move(grip.x+5,grip.y+5);await page.mouse.down();await page.mouse.move(dest.x,dest.y,{steps:10});
 await expect(page.locator('[data-id=d]')).toHaveClass(/drawer-drop-target/);await page.mouse.up();
 await expect(page.locator('[data-id=d] .drawer-entry')).toHaveCount(2);
 await expect(page.locator('[data-id=d] [data-drawer-toggle]')).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('#save-status')).toContainText('모든 변경사항 저장됨');await page.reload();
 await expect(page.locator('[data-id=d] .drawer-entry')).toHaveCount(2);
 await page.locator('[data-id=d] [data-drawer-out=a]').click();await expect(page.locator('[data-id=d] .drawer-entry')).toHaveCount(1);
});
test('drawer deletion removes its contents and undo preserves unrelated edits',async({page})=>{
 await seedInteractionBoard(page,[{id:'d',type:'drawer',x:100,y:100,w:380,h:60},{id:'inside',type:'note',parentId:'d',x:100,y:100},{id:'file',type:'file',parentId:'d',fileId:'native-record',name:'original.hwp',x:100,y:100},{id:'other',type:'text',x:600,y:100,w:400,h:100,text:'그대로 둘 내용'}]);
 await page.locator('[data-id=d] > .edge-right').click();await page.locator('[data-block-action=delete]').click();
 await expect(page.locator('.block')).toHaveCount(1);
 await page.locator('[data-id=other] .editable').fill('삭제 이후에 수정한 내용');
 await page.getByRole('button',{name:'삭제 취소',exact:true}).click();
 await page.locator('[data-id=d] [data-drawer-toggle]').click();await expect(page.locator('.drawer-entry')).toHaveCount(2);
 await expect(page.locator('[data-id=other] .editable')).toHaveText('삭제 이후에 수정한 내용');
 await expect(page.locator('#save-status')).toContainText('모든 변경사항 저장됨');await page.reload();await expect(page.locator('.drawer-entry')).toHaveCount(2);
 await page.locator('[data-id=d] > .edge-right').click();await page.locator('#canvas').focus();await page.keyboard.press('Delete');
 await expect(page.locator('#save-status')).toContainText('모든 변경사항 저장됨');await page.reload();await expect(page.locator('.block')).toHaveCount(1);
});
test('text settings live below insertion toolbar and formatting persists',async({page})=>{
 await seedInteractionBoard(page,[{id:'text',type:'text',x:100,y:100,w:600,h:200,text:'한글과 English 서식'},{id:'link',type:'web',url:'https://example.com',text:'외부 링크',x:100,y:360,w:300,h:100},{id:'check-format',type:'checkbox',x:750,y:360,w:300,h:80,text:'서식이 있는 체크'}]);
 await page.locator('[data-id=text] .edge-top').click();
 const mainToolbar=await page.locator('.toolbar').boundingBox(),settings=await page.locator('#selection-tools').boundingBox(),viewport=await page.locator('#viewport').boundingBox();
 expect(settings.y).toBeGreaterThanOrEqual(mainToolbar.y+mainToolbar.height-1);expect(settings.y+settings.height).toBeLessThanOrEqual(viewport.y+1);expect(settings.height).toBeLessThanOrEqual(50);
 await page.locator('[data-prop="text:font"]').selectOption('arial');await editSetting(page,'text:size',28);
 for(const name of ['굵게','기울임','밑줄','취소선'])await page.getByRole('button',{name,exact:true}).click();
 await page.locator('[data-prop="text:align"]').selectOption('center');
 const text=page.locator('[data-id=text] .editable');await expect(text).toHaveCSS('font-size','28px');await expect(text).toHaveCSS('font-weight','700');await expect(text).toHaveCSS('font-style','italic');await expect(text).toHaveCSS('text-decoration-line','underline line-through');await expect(text).toHaveCSS('text-align','center');
 await expect(text).toHaveCSS('font-family',/Arial/);
 await expect(page.locator('#save-status')).toContainText('모든 변경사항 저장됨');await page.reload();await expect(text).toHaveCSS('font-size','28px');await expect(text).toHaveCSS('text-decoration-line','underline line-through');
 await text.fill('서식을 유지하면서 내용 수정');await expect(text).toHaveCSS('font-weight','700');
 await text.click({modifiers:['Shift']});await expect(page.locator('.block.selected')).toHaveCount(1);
 await page.locator('[data-id=link] .edge-top').click();await editSetting(page,'text:size',22);await page.getByRole('button',{name:'굵게',exact:true}).click();
 await expect(page.locator('[data-id=link] strong')).toHaveCSS('font-size','22px');await expect(page.locator('[data-id=link] strong')).toHaveCSS('font-weight','400');
 await page.locator('[data-id=check-format] .edge-right').click();await page.getByRole('button',{name:'밑줄',exact:true}).click();
 await page.locator('[data-id=check-format] [data-check]').check();await expect(page.locator('[data-id=check-format] .editable')).toHaveCSS('text-decoration-line','underline line-through');
 await page.locator('[data-id=check-format] [data-check]').uncheck();await expect(page.locator('[data-id=check-format] .editable')).toHaveCSS('text-decoration-line','underline');
});
test('media and line settings persist and position locking prevents accidental moves',async({page})=>{
 const {readFile}=await import('node:fs/promises');
 await seedInteractionBoard(page,[{id:'line',type:'hline',x:500,y:100,w:300,h:16}]);
 await page.locator('[data-id=line] .edge-top').click();await editSetting(page,'lineWidth',5);await page.locator('[data-prop=direction]').selectOption('vline');
 await expect(page.locator('[data-id=line]')).toHaveClass(/block-vline/);
 expect(await page.locator('[data-id=line]').evaluate(el=>parseFloat(getComputedStyle(el,'::before').width))).toBeCloseTo(5,1);
 await page.locator('#media-input').setInputFiles({name:'clip.webm',mimeType:'video/webm',buffer:await readFile('tests/fixtures/clip.webm')});
 await page.locator('[data-prop=fit]').selectOption('cover');await page.locator('[data-prop=videoLoop]').check();await page.locator('[data-prop=videoMuted]').check();
 const video=page.locator('video');await expect.poll(()=>video.evaluate(v=>v.loop&&v.muted)).toBe(true);await expect(video).toHaveCSS('object-fit','cover');
 await page.locator('[data-prop=locked]').check();await expect(page.locator('.block-media > .drag-handle')).toBeHidden();
 await expect(page.locator('#save-status')).toContainText('모든 변경사항 저장됨');await page.reload();await expect.poll(()=>video.evaluate(v=>v.loop&&v.muted)).toBe(true);await expect(video).toHaveCSS('object-fit','cover');
});

test('dragging a native shortcut into a drawer preserves identity without opening or copying it',async({page})=>{
 await seedInteractionBoard(page,[]);
 await page.evaluate(()=>{window.nativeOpened=[];window.moaDesktop={pickFiles:async()=>[{id:'native-original',name:'원본.hwp',path:'C:/Documents/원본.hwp'}],openFile:async id=>window.nativeOpened.push(id)};});
 await page.locator('.toolbar [data-action=register]').click();
 const card=page.locator('.file-open');const fileId=await card.getAttribute('data-file');
 await card.click({modifiers:['Shift']});await expect(page.locator('.block.selected')).toHaveCount(0);expect(await page.evaluate(()=>window.nativeOpened)).toEqual([]);
 await page.locator('[data-add=drawer]').click();await editSetting(page,'x',700);await editSetting(page,'y',100);
 const source=await card.boundingBox(),dest=await boardCoordinates(page,750,130);
 await page.mouse.move(source.x+100,source.y+40);await page.mouse.down();await page.mouse.move(dest.x,dest.y,{steps:12});await page.mouse.up();
 await expect(page.locator('.block-drawer .file-open')).toHaveAttribute('data-file',fileId);expect(await page.evaluate(()=>window.nativeOpened)).toEqual([]);
 const record=await page.evaluate(async id=>{const db=await new Promise(resolve=>{const r=indexedDB.open('moa-workspace',1);r.onsuccess=()=>resolve(r.result)});return new Promise(resolve=>{const r=db.transaction('files').objectStore('files').get(id);r.onsuccess=()=>resolve(r.result)})},fileId);
 expect(record.path).toBe('C:/Documents/원본.hwp');expect(record.mode).toBe('desktop');expect(record.file).toBeUndefined();
});
test('marquee auto-scroll selects offscreen objects and Escape cancels a drag',async({page})=>{
 await seedInteractionBoard(page,[{id:'a',type:'note',x:100,y:100},{id:'b',type:'note',x:400,y:1250}]);
 await page.evaluate(async()=>{
  const db=await new Promise(resolve=>{const r=indexedDB.open('moa-workspace',1);r.onsuccess=()=>resolve(r.result)});
  const state=await new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('workspace');r.onsuccess=()=>resolve(r.result)});state.pages[0].height=1800;
  await new Promise(resolve=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(state,'workspace');tx.oncomplete=resolve});
 });
 await page.reload();const start=await boardCoordinates(page,40,40),viewport=await page.locator('#viewport').boundingBox();
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+610*start.z,viewport.y+viewport.height-10,{steps:8});
 await expect.poll(()=>page.locator('#viewport').evaluate(el=>el.scrollTop)).toBeGreaterThan(850);
 await page.mouse.up();await expect(page.locator('.block.selected')).toHaveCount(2);
 await page.locator('[data-id=b] > .drag-handle').scrollIntoViewIfNeeded();
 const handle=await page.locator('[data-id=b] > .drag-handle').boundingBox();
 await page.mouse.move(handle.x+5,handle.y+5);await page.mouse.down();await page.mouse.move(handle.x+85,handle.y+45,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();
 expect(await page.locator('[data-id=a]').evaluate(el=>[parseFloat(el.style.left),parseFloat(el.style.top)])).toEqual([100,100]);
 expect(await page.locator('[data-id=b]').evaluate(el=>[parseFloat(el.style.left),parseFloat(el.style.top)])).toEqual([400,1250]);
 await expect(page.locator('.selection-marquee')).toHaveCount(0);
});

test('untrusted formatting values cannot create HTML attributes in the settings row',async({page})=>{
 const payload='" autofocus onfocus="window.formatInjected=1';
 await seedInteractionBoard(page,[{id:'untrusted',type:'text',x:100,y:100,w:300,h:100,format:{size:payload,lineHeight:payload},rotation:payload}]);
 await page.locator('[data-id=untrusted] .edge-top').click();
 expect(await page.evaluate(()=>window.formatInjected)).toBeUndefined();
 await expect(page.locator('#selection-tools [onfocus]')).toHaveCount(0);
 await expect(page.locator('[data-prop="text:size"]')).toHaveValue('8');await expect(page.locator('#rotation-angle')).toHaveValue('0');
});

test('Cotion serif branding, actual heading alignment and multiline frames persist',async({page})=>{
 await seedInteractionBoard(page,[{id:'heading',type:'text',role:'heading',x:80,y:80,w:500,h:300,text:'정렬 확인'},{id:'plain',type:'text',x:650,y:80,w:260,h:260,text:'initial'}]);
 await expect(page.locator('.brand-wordmark')).toHaveText('코션');await expect(page.locator('.brand-wordmark')).toHaveCSS('font-family',/Cotion Title Serif/);
 await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>[...document.fonts].some(f=>f.family.includes('Cotion Title Serif')&&f.status==='loaded'))).toBe(true);
 await expect(page).toHaveTitle(/코션/);await expect(page.getByRole('button',{name:'서식 초기화',exact:true})).toHaveCount(0);
 await page.locator('[data-id=heading] > .edge-top').click();
 const rangeX=()=>page.locator('[data-id=heading] .editable').evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect().x});
 const positions=[];for(const align of ['left','center','right']){await page.locator('[data-prop="text:align"]').selectOption(align);positions.push(await rangeX());}
 expect(positions[1]-positions[0]).toBeGreaterThan(100);expect(positions[2]-positions[1]).toBeGreaterThan(100);
 const heading=page.locator('[data-id=heading] .editable');await heading.fill('첫 번째 줄\n두 번째 줄\n세 번째 줄\n네 번째 줄');
 expect(await heading.evaluate(el=>el.clientHeight)).toBeGreaterThan(200);
 expect(await heading.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(2);
 const plain=page.locator('[data-id=plain] .editable');await plain.fill('A'.repeat(140));
 expect(await plain.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(2);expect(await plain.evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect().height})).toBeGreaterThan(60);
 await expect(page.locator('#save-status')).toContainText('모든 변경사항 저장됨');await page.reload();await expect(heading).toHaveText('첫 번째 줄\n두 번째 줄\n세 번째 줄\n네 번째 줄');await expect(heading).toHaveCSS('text-align','right');
});
test('rotation fields, quarter turns and handles never change stored position or size',async({page})=>{
 await seedInteractionBoard(page,[{id:'rot',type:'rect',x:0,y:0,w:600,h:120}]);
 await page.locator('[data-id=rot] > .edge-bottom').click();
 const geometry=()=>page.locator('[data-id=rot]').evaluate(el=>[el.style.left,el.style.top,el.style.width,el.style.height]);const original=await geometry();
 await page.locator('#rotation-angle').fill('90');await page.locator('#rotation-angle').press('Tab');expect(await geometry()).toEqual(original);
 await page.locator('[data-block-action=rotate]').click();expect(await geometry()).toEqual(original);
 await page.locator('#rotation-angle').fill('0');await page.locator('#rotation-angle').press('Tab');
 // Bring the handle inside the viewport without changing rotation semantics.
 await editSetting(page,'x',250);await editSetting(page,'y',200);const moved=await geometry();
 const box=await page.locator('[data-id=rot]').boundingBox(),handle=await page.locator('[data-id=rot] > .rotate-handle').boundingBox();
 const center={x:box.x+box.width/2,y:box.y+box.height/2},start={x:handle.x+12,y:handle.y+12},dx=start.x-center.x,dy=start.y-center.y;
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(center.x+dx*Math.SQRT1_2-dy*Math.SQRT1_2,center.y+dx*Math.SQRT1_2+dy*Math.SQRT1_2,{steps:8});await page.mouse.up();
 expect(await geometry()).toEqual(moved);await expect(page.locator('#rotation-angle')).toHaveValue('45');
 await expect(page.locator('#save-status')).toContainText('모든 변경사항 저장됨');await page.reload();expect(await geometry()).toEqual(moved);
});
test('all additional shapes have editable vector surfaces and survive reload',async({page})=>{
 await seedInteractionBoard(page,[]);
 for(const type of ['rounded','triangle','diamond','pentagon','hexagon','star','arrow','parallelogram','speech','heart']) {
  await page.locator('[data-menu=shapes]').click();await page.locator(`[data-add=${type}]`).click();
  const shape=page.locator(`.block-${type}`);await expect(shape.locator('.shape-surface')).toBeVisible();await shape.locator('.editable').fill(type+' label');
 }
 await expect(page.locator('.block-shape')).toHaveCount(10);
 await expect(page.locator('#save-status')).toContainText('모든 변경사항 저장됨');await page.reload();await expect(page.locator('.block-shape')).toHaveCount(10);await expect(page.locator('.block-heart .editable')).toHaveText('heart label');
});
test('Windows edit shortcuts format, nudge, save and undo/redo without losing content',async({page})=>{
 await seedInteractionBoard(page,[{id:'t',type:'text',x:100,y:100,w:400,h:180,text:'abc'}]);
 await page.locator('[data-id=t] > .edge-left').click();await page.locator('#canvas').focus();
 await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowDown');
 expect(await page.locator('[data-id=t]').evaluate(el=>[parseFloat(el.style.left),parseFloat(el.style.top)])).toEqual([101,110]);
 await page.keyboard.press('Control+d');await expect(page.locator('.block-text')).toHaveCount(2);
 await page.keyboard.press('Control+z');await expect(page.locator('.block-text')).toHaveCount(1);await page.keyboard.press('Control+y');await expect(page.locator('.block-text')).toHaveCount(2);
 await page.keyboard.press('F2');const editor=page.locator('.block.selected .editable');await expect(editor).toBeFocused();
 await page.keyboard.press('Control+b');await expect(editor).toHaveCSS('font-weight','700');await expect(editor).toBeFocused();
 await page.keyboard.press('Control+i');await expect(editor).toHaveCSS('font-style','italic');await page.keyboard.press('Control+u');await expect(editor).toHaveCSS('text-decoration-line','underline');
 await page.keyboard.press('Control+e');await expect(editor).toHaveCSS('text-align','center');
 await page.keyboard.press('Control+z');await expect(editor).not.toHaveCSS('text-align','center');await page.keyboard.press('Control+Shift+z');await expect(editor).toHaveCSS('text-align','center');
 let downloads=0;page.on('download',()=>downloads++);await page.keyboard.press('Control+s');await expect(page.locator('#toast')).toContainText('저장했습니다');expect(downloads).toBe(0);
 await page.reload();await expect(page.locator('.block-text')).toHaveCount(2);
});
test('single object alignment uses the board while multiple alignment uses selected objects',async({page})=>{
 await seedInteractionBoard(page,[{id:'a',type:'note',x:100,y:100,w:200,h:150},{id:'b',type:'note',x:500,y:100,w:200,h:150}]);
 await page.locator('[data-id=a] > .edge-bottom').click();await page.locator('[data-prop=objectAlign]').selectOption('center-x');
 expect(await page.locator('[data-id=a]').evaluate(el=>parseFloat(el.style.left))).toBe(480);
 await page.locator('[data-prop=objectAlign]').selectOption('left');expect(await page.locator('[data-id=a]').evaluate(el=>parseFloat(el.style.left))).toBe(0);
 await page.locator('[data-prop=objectAlign]').selectOption('right');expect(await page.locator('[data-id=a]').evaluate(el=>parseFloat(el.style.left))).toBe(960);
 await page.locator('[data-id=b] > .edge-bottom').click({modifiers:['Shift']});await page.locator('[data-block-action=align-left]').click();
 expect(await page.locator('[data-id=a]').evaluate(el=>parseFloat(el.style.left))).toBe(500);
});
test('object keyboard copy/cut/paste preserves drawer references across pages',async({page})=>{
 await seedInteractionBoard(page,[{id:'d',type:'drawer',x:100,y:100,w:380,h:60},{id:'child',parentId:'d',type:'file',x:0,y:0,w:290,h:86,fileId:'native-file',name:'original.hwp'}]);
 await page.locator('[data-id=d] > .edge-bottom').click();await page.locator('#canvas').focus();
 // Record the platform clipboard boundary; the actual keyboard invokes the app's copy handler.
 await page.evaluate(()=>{window.copiedClipboard=null;document.addEventListener('copy',e=>{window.copiedClipboard={custom:e.clipboardData.getData('application/x-cotion-blocks'),text:e.clipboardData.getData('text/plain')}},false)});
 await page.keyboard.press('Control+c');
 await expect.poll(()=>page.evaluate(()=>window.copiedClipboard?.custom||'')).not.toBe('');
 await page.keyboard.press('Control+n');
 await page.keyboard.press('Control+v');
 await expect(page.locator('.block-drawer')).toHaveCount(1);await page.locator('[data-drawer-toggle]').click();await expect(page.locator('.drawer-entry .file-open')).toHaveAttribute('data-file','native-file');
 await page.locator('.block-drawer > .edge-right').click();await page.locator('#canvas').focus();await page.keyboard.press('Control+x');await expect(page.locator('.block-drawer')).toHaveCount(0);
 await page.keyboard.press('Control+z');await expect(page.locator('.block-drawer')).toHaveCount(1);
});

test('icon rendering keeps existing SVGs while editing and fills dynamic controls', async ({page}) => {
  await expect(page.locator('i[data-lucide]')).toHaveCount(0);
  await page.locator('[data-add=note]').click();
  await page.evaluate(() => {window.__existingIcon = document.querySelector('.workspace-switch svg');});
  await page.locator('.block-note').last().locator('.editable').fill('아이콘을 다시 만들지 않는 저장');
  await expect(page.locator('#save-status')).toContainText('모든 변경사항 저장됨');
  expect(await page.evaluate(() => document.querySelector('.workspace-switch svg') === window.__existingIcon)).toBe(true);
  await expect(page.locator('#save-status svg.lucide-circle-check')).toHaveCount(1);
  await expect(page.locator('i[data-lucide]')).toHaveCount(0);
  await page.locator('[data-action=help]').first().click();
  await expect(page.locator('[role=dialog]')).toBeVisible();
  await expect(page.locator('i[data-lucide]')).toHaveCount(0);
});

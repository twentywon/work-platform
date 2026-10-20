import { getFile } from "./storage.js";
const cache = new Map();
const pending = new Map();
export const extension = (name) => name.split(".").pop().toLowerCase();
export async function previewFile(record) {
  if (pending.has(record.id)) return pending.get(record.id);
  const promise = createPreview(record).finally(() => pending.delete(record.id));
  pending.set(record.id, promise);
  return promise;
}
async function createPreview(record) {
  const file = await getFile(record);
  const key = record.id + ":" + file.lastModified + ":" + file.size;
  if (cache.has(key)) return cache.get(key);
  const ext = extension(file.name);
  let result;
  let imageUnavailable = "";
  if (["hwp", "hwpx", "doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) {
    const nativeOffice = record.mode === "desktop" && window.moaDesktop?.firstPage && ["doc","docx","xls","xlsx","ppt","pptx"].includes(ext);
    const embedded = nativeOffice ? null : await embeddedPage(file).catch(() => null);
    if (embedded) { cache.set(key, embedded); return embedded; }
    if (record.mode === "desktop" && window.moaDesktop?.firstPage) {
      try {
        const page = await window.moaDesktop.firstPage(record.desktopId);
        const url = page.format === "pdf"
          ? await (await import("./pdf-page.js")).firstPDFPage(page.bytes)
          : URL.createObjectURL(new Blob([page.bytes], {type:"image/png"}));
        result = { type:"page-image", url, source:page.source };
        cache.set(key, result); return result;
      } catch (e) { imageUnavailable = e.message; }
    } else imageUnavailable = "저장된 첫 페이지 이미지가 없습니다. 설치된 Office를 이용하려면 코션 실행.vbs로 실행해 주세요.";
  }
  if (
    file.type.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)
  )
    result = { type: "image", url: URL.createObjectURL(file) };
  else if (ext === "pdf") {
    result = { type:"pdf", url:URL.createObjectURL(file) };
    try { result.firstPage = await (await import("./pdf-page.js")).firstPDFPage(await file.arrayBuffer()); }
    catch (e) { result.imageUnavailable = "PDF 첫 페이지 이미지 생성 실패: " + e.message; }
  }
  else if (["txt", "md", "csv", "json", "log"].includes(ext))
    result = { type: "text", text: (await file.text()).slice(0, 30000) };
  else if (ext === "docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    result = {
      type: "text",
      text: (
        await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
      ).value,
    };
  } else if (["xlsx", "xls"].includes(ext)) {
    const XLSX = await import("xlsx");
    const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
    result = {
      type: "sheets",
      sheets: book.SheetNames.map((name) => ({
        name,
        rows: XLSX.utils
          .sheet_to_json(book.Sheets[name], {
            header: 1,
            defval: "",
            blankrows: false,
          })
          .slice(0, 60)
          .map((r) => r.slice(0, 15)),
      })),
    };
  } else if (["pptx", "hwpx"].includes(ext)) {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const paths = Object.keys(zip.files)
      .filter((p) =>
        ext === "pptx"
          ? /^ppt\/slides\/slide\d+\.xml$/.test(p)
          : /^Contents\/section\d+\.xml$/.test(p),
      )
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const parts = await Promise.all(
      paths.map(async (p) => {
        const xml = new DOMParser().parseFromString(
          await zip.file(p).async("string"),
          "application/xml",
        );
        return [...xml.getElementsByTagNameNS("*", "t")]
          .map((n) => n.textContent)
          .join("\n");
      }),
    );
    result = {
      type: "text",
      text:
        parts
          .map(
            (s, i) =>
              `${ext === "pptx" ? "슬라이드" : "구역"} ${i + 1}\n\n${s}`,
          )
          .join("\n\n──────────\n\n") || "추출할 수 있는 텍스트가 없습니다.",
    };
  } else
    result = {
      type: "unsupported",
      text: "이 형식은 브라우저에서 미리보기를 지원하지 않습니다. 원본 프로그램에서 문서를 열어 주세요.",
    };
  if (imageUnavailable) result.imageUnavailable = imageUnavailable;
  cache.set(key, result);
  return result;
}

async function embeddedPage(file) {
  const ext = extension(file.name);
  let bytes;
  let mime;
  if (ext === "hwp") {
    const CFB = await import("cfb");
    const container = CFB.read(new Uint8Array(await file.arrayBuffer()),{type:"array"});
    const image = container.FileIndex.find(entry=>entry.name === "PrvImage");
    if (image?.content?.length) {
      bytes = new Uint8Array(image.content);
      mime = bytes[0] === 0x89 ? "image/png" : bytes[0] === 0x42 && bytes[1] === 0x4d ? "image/bmp" : bytes[0] === 0xff ? "image/jpeg" : null;
    }
  } else if (["hwpx", "docx", "xlsx", "pptx"].includes(ext)) {
    const {default:JSZip} = await import("jszip");
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const path = Object.keys(zip.files).find(p=>/^(Preview\/PrvImage|docProps\/thumbnail)\.(png|jpe?g|bmp)$/i.test(p));
    if(path) { bytes=await zip.file(path).async("uint8array"); mime=/\.png$/i.test(path)?"image/png":/\.bmp$/i.test(path)?"image/bmp":"image/jpeg"; }
  }
  if(!bytes || !mime) return null;
  const blob = new Blob([bytes],{type:mime});
  // Validate the actual image; a stale or corrupt embedded picture must fall back.
  const image = await createImageBitmap(blob);
  image.close();
  return { type:"page-image", url:URL.createObjectURL(blob), savedPreview: !["hwp", "hwpx"].includes(ext), source:ext === "hwp" || ext === "hwpx" ? "문서에 저장된 첫 페이지 이미지" : "문서에 저장된 미리보기 이미지 (첫 페이지와 다를 수 있습니다)" };
}

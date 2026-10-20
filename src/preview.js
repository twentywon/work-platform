import { getFile } from "./storage.js";
const cache = new Map();
export const extension = (name) => name.split(".").pop().toLowerCase();
export async function previewFile(record) {
  const file = await getFile(record);
  const key = record.id + ":" + file.lastModified + ":" + file.size;
  if (cache.has(key)) return cache.get(key);
  const ext = extension(file.name);
  let result;
  if (
    file.type.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)
  )
    result = { type: "image", url: URL.createObjectURL(file) };
  else if (ext === "pdf")
    result = { type: "pdf", url: URL.createObjectURL(file) };
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
      text: "이 형식은 브라우저에서 미리보기를 지원하지 않습니다. 파일을 내려받아 컴퓨터의 연결 프로그램으로 열어 주세요.",
    };
  cache.set(key, result);
  return result;
}

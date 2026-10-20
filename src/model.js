export const uid = () => globalThis.crypto.randomUUID();
export function makePage(index, width = 1160, height = 760) {
  return { id: uid(), title: `새 페이지 ${index}`, width, height, blocks: [] };
}
export function makeBlock(type, x = 60, y = 210, extra = {}) {
  const sizes = {
    note: [290, 190],
    text: [350, 100],
    table: [490, 220],
    rect: [240, 150],
    circle: [160, 160],
    hline: [450, 16],
    vline: [16, 280],
    file: [290, 86],
  };
  const [w, h] = sizes[type] || [290, 190];
  return {
    id: uid(),
    type,
    x,
    y,
    w,
    h,
    text:
      type === "note"
        ? "여기에 아이디어를 적어보세요."
        : type === "text"
          ? "내용을 입력하세요."
          : "",
    color: type === "note" ? "#fff4ce" : "#e9edff",
    ...extra,
  };
}
export function fitScale(page, width, height) {
  return Math.min(width / page.width, height / page.height, 1);
}
export function clampBlock(block, page) {
  block.w = Math.min(block.w, page.width);
  block.h = Math.min(block.h, page.height);
  block.x = Math.max(0, Math.min(block.x, page.width - block.w));
  block.y = Math.max(0, Math.min(block.y, page.height - block.h));
  return block;
}

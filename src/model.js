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
    rotation: 0,
    color: type === "note" ? "#fff4ce" : "#e9edff",
    ...extra,
  };
}
export function fitScale(page, width, height) {
  return width / page.width;
}
export function clampBlock(block, page) {
  block.w = Math.min(block.w, page.width);
  block.h = Math.min(block.h, page.height);
  const a = (block.rotation || 0) * Math.PI / 180;
  const rotatedWidth = Math.abs(block.w * Math.cos(a)) + Math.abs(block.h * Math.sin(a));
  const rotatedHeight = Math.abs(block.w * Math.sin(a)) + Math.abs(block.h * Math.cos(a));
  const factor = Math.min(1, page.width / rotatedWidth, page.height / rotatedHeight);
  block.w *= factor; block.h *= factor;
  const mx = (rotatedWidth * factor - block.w) / 2;
  const my = (rotatedHeight * factor - block.h) / 2;
  block.x = Math.max(mx, Math.min(block.x, page.width - block.w - mx));
  block.y = Math.max(my, Math.min(block.y, page.height - block.h - my));
  return block;
}

export const GRID = 20;
export const snap = value => Math.round(value / GRID) * GRID;
export function rotatedDelta(dx, dy, rotation) {
  const angle = rotation * Math.PI / 180;
  return { x: dx * Math.cos(angle) + dy * Math.sin(angle), y: -dx * Math.sin(angle) + dy * Math.cos(angle) };
}

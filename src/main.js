import "./style.css";
import "./local-bridge.js";
import { createIcons, icons } from "lucide";
import { uid, makePage, makeBlock, fitScale, clampBlock, snap, rotatedDelta } from "./model.js";
import { read, write, getFile } from "./storage.js";
import { previewFile, extension } from "./preview.js";
const $ = (s) => document.querySelector(s);
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (name, cls = "") => `<i data-lucide="${name}" class="${cls}"></i>`;
let state,
  active,
  selected = null,
  zoom = 1,
  manualZoom = null,
  saveTimer,
  hoverTimer,
  previewToken = 0;
const fileRecords = new Map();
const colors = [
  "#fff4ce",
  "#e9edff",
  "#e4f3ed",
  "#fde9e6",
  "#eef1f5",
  "#ffffff",
];
async function persist() {
  clearTimeout(saveTimer);
  $("#save-status").innerHTML = icon("loader-circle") + " 저장 중";
  refreshIcons();
  saveTimer = setTimeout(async () => {
    try {
      await write("state", state, "workspace");
      $("#save-status").innerHTML =
        icon("cloud-check") + " 모든 변경사항 저장됨";
    } catch {
      $("#save-status").textContent = "저장 실패 · 저장 공간을 확인해 주세요";
      toast("저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.");
    }
    refreshIcons();
  }, 250);
}
function refreshIcons() {
  document
    .querySelectorAll("svg[data-lucide]")
    .forEach((el) => el.removeAttribute("data-lucide"));
  createIcons({ icons, attrs: { "stroke-width": 1.7 } });
}
function toast(message) {
  let el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(el.timer);
  el.timer = setTimeout(() => el.classList.remove("show"), 4000);
}
const page = () => state.pages.find((p) => p.id === active);
function fileStyle(name) {
  const ext = extension(name);
  return ["xlsx", "xls", "csv"].includes(ext)
    ? ["sheet", "#e5f3ec", "#388965"]
    : ["pptx", "ppt"].includes(ext)
      ? ["presentation", "#fff0e7", "#d17b47"]
      : ["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext)
        ? ["image", "#ede8fb", "#9272cf"]
        : ext === "pdf"
          ? ["file-text", "#fdeceb", "#d77770"]
          : ["file-text", "#e9efff", "#5c7fc9"];
}
async function init() {
  try {
    state = await read("state", "workspace");
  } catch {
    toast("브라우저 저장소를 사용할 수 없습니다.");
  }
  if (!state) {
    const p = makePage(1);
    p.title = "우리의 새로운 시작";
    p.subtitle = "생각을 모으고, 연결하고, 함께 완성하는 공간";
    p.blocks = [
      makeBlock("text", 48, 42, {
        w: 850,
        h: 85,
        text: "조금 더 가벼운 업무의 시작",
        role: "heading",
      }),
      makeBlock("text", 50, 140, {
        w: 900,
        h: 42,
        text: "흩어진 자료와 아이디어를 한곳에 모아보세요. 나만의 방식으로 자유롭게.",
      }),
      makeBlock("hline", 48, 204, { w: 1064 }),
      makeBlock("note", 48, 251, {
        w: 324,
        h: 246,
        text: "이번 주, 함께 해볼 일\n\n☐ 프로젝트 자료 한곳에 모으기\n☐ 새로운 아이디어 기록하기\n☐ 나만의 작업 공간 만들기",
        color: "#fff4ce",
        label: "WEEKLY PLAN",
      }),
      makeBlock("note", 394, 251, {
        w: 324,
        h: 246,
        text: "좋은 아이디어는\n사소한 메모에서 시작돼요.\n\n떠오르는 생각을 자유롭게 적고,\n원하는 위치로 옮겨보세요.",
        color: "#e9edff",
        label: "A LITTLE INSPIRATION",
      }),
      makeBlock("rect", 744, 251, {
        w: 366,
        h: 246,
        text: "아이디어 → 기록 → 실행\n\n작은 연결이 만드는 큰 변화",
        color: "#e4f3ed",
      }),
      makeBlock("text", 48, 551, {
        w: 550,
        h: 44,
        text: "작업에 필요한 파일",
        role: "section",
      }),
    ];
    if (window.moaDesktop) {
      p.blocks.push(
        makeBlock("text", 48, 610, {
          w: 1000,
          h: 60,
          text: "파일 바로가기를 추가해 보세요. 컴퓨터의 원본 파일을 연결 프로그램으로 엽니다.",
        }),
      );
    } else {
      const demo = new File(
        [
          "모아에 오신 것을 환영합니다.\n\n상단 도구모음으로 메모, 표, 도형과 구분선을 추가해 보세요.\n블록을 클릭하면 나타나는 손잡이로 이동하고, 오른쪽 아래 모서리로 크기를 바꿀 수 있습니다.\n\n파일 연결: 지원하는 브라우저에서는 원본 파일을 연결합니다.\n권한을 다시 요청할 수 있으며, 파일을 이동하거나 삭제하면 재등록이 필요합니다.\n그 외 브라우저는 등록 시점의 파일 사본을 보관합니다.\n\n이 공간은 현재 브라우저에 자동 저장됩니다.",
        ],
        "시작 가이드.txt",
        { type: "text/plain" },
      );
      const id = uid();
      await write("files", { id, name: demo.name, file: demo, mode: "copy" });
      p.blocks.push(
        makeBlock("file", 48, 610, { fileId: id, name: demo.name, w: 324 }),
      );
    }
    state = { pages: [p], active: p.id };
    await write("state", state, "workspace");
  }
  active = state.active || state.pages[0].id;
  render();
}
function render() {
  const p = page();
  document.title = `${p.title} · 모아`;
  $("#app").innerHTML = `
<aside class="sidebar"><a class="brand" href="#" aria-label="모아 홈"><span class="brand-symbol">${icon("layers")}</span>모아<span class="brand-dot">.</span></a>
<button class="workspace-switch"> <span class="workspace-avatar">나</span><span><strong>나의 워크스페이스</strong><small>Personal workspace</small></span>${icon("chevrons-up-down")}</button>
<div class="side-label">워크스페이스</div><button class="side-nav active" data-action="pages">${icon("layout-dashboard")}내 작업 공간<span>${state.pages.length}</span></button><button class="side-nav" data-action="files">${icon("folder-open")}파일 모아보기</button>
<div class="pages-header"><span>내 페이지</span><button class="icon-btn" data-action="add-page" title="새 페이지 추가">${icon("plus")}</button></div>
<nav class="page-nav">${state.pages.map((x, i) => `<button data-page="${x.id}" class="page-item ${x.id === active ? "current" : ""}">${icon("file")}<span>${escape(x.title)}</span>${x.id === active ? '<span class="current-dot"></span>' : ""}</button>`).join("")}</nav>
<button class="new-page" data-action="add-page">${icon("plus")}새 페이지 만들기</button>
<div class="side-bottom"><div class="tip-card"><span class="tip-icon">${icon("sparkles")}</span><strong>생각을 펼쳐보세요</strong><p>메모부터 파일까지,<br>모든 업무를 나만의 공간에.</p><button data-action="help">모아 사용 가이드 ${icon("arrow-up-right")}</button></div><div class="local-label">${icon("hard-drive")}이 브라우저에 안전하게 보관</div><button class="profile" data-action="help"><span class="profile-avatar">나</span><span>나의 공간<small>개인 워크스페이스</small></span>${icon("circle-help")}</button></div></aside>
<main><header class="topbar"><div class="breadcrumb">워크스페이스 ${icon("chevron-right")}<input id="page-title" aria-label="페이지 이름" value="${escape(p.title)}" maxlength="70"/></div><div class="top-actions"><span id="save-status">${icon("cloud-check")}모든 변경사항 저장됨</span><button class="icon-btn" data-action="help" title="사용 가이드">${icon("circle-help")}</button></div></header>
<section class="toolbar" aria-label="삽입 도구모음"><div class="toolbar-group"><button data-add="text">${icon("type")}<span>텍스트</span></button><button data-add="note">${icon("sticky-note")}<span>메모</span></button><button data-add="table">${icon("table-2")}<span>표</span></button><div class="dropdown"><button data-menu="shapes">${icon("shapes")}<span>도형</span>${icon("chevron-down")}</button><div class="menu" id="shapes-menu"><button data-add="rect">${icon("square")}사각형</button><button data-add="circle">${icon("circle")}원</button></div></div><div class="dropdown"><button data-menu="lines">${icon("columns-2")}<span>구분선</span>${icon("chevron-down")}</button><div class="menu" id="lines-menu"><button data-add="hline">${icon("minus")}가로 구분선</button><button data-add="vline">${icon("move-vertical")}세로 구분선</button></div></div></div><span class="toolbar-divider"></span><button class="link-tool" data-action="register">${icon("link")}<span>파일 연결</span></button><button class="link-tool" data-action="link-folder">${icon("folder-open")}<span>연결 폴더</span></button><div class="toolbar-right"><span>가로폭 맞춤 · 격자 20px</span>${icon("lock-keyhole")}<button class="dimensions" data-action="dimensions">${p.width} × ${p.height}</button></div></section>
<div class="canvas-meta"><span>${icon("panel-top")} 자유롭게 배치하는 나의 보드</span><span>클릭해서 편집 · 드래그해서 이동</span></div>
<div class="canvas-viewport" id="viewport"><div class="canvas-space" id="canvas-space"><div class="canvas" id="canvas" style="width:${p.width}px;height:${p.height}px">${p.blocks.map(blockHTML).join("")}<div class="canvas-footer"><span>MADE FOR YOUR IDEAS</span><span>MOA WORKSPACE · ${String(state.pages.indexOf(p) + 1).padStart(2, "0")}</span></div></div></div><div id="selection-tools"></div></div>
<footer class="bottom-bar"><span class="page-count">${state.pages.indexOf(p) + 1} / ${state.pages.length} 페이지</span><div class="pagination"><button data-action="prev-page" title="이전 페이지" ${state.pages.indexOf(p) === 0 ? "disabled" : ""}>${icon("chevron-left")}</button>${state.pages.map((x, i) => `<button data-page="${x.id}" class="${x.id === active ? "chosen" : ""}" aria-label="${i + 1}페이지">${i + 1}</button>`).join("")}<button data-action="next-page" title="다음 페이지" ${state.pages.indexOf(p) === state.pages.length - 1 ? "disabled" : ""}>${icon("chevron-right")}</button><span></span><button data-action="add-page" title="새 페이지">${icon("plus")}</button></div><div class="zoom-tools"><button data-action="zoom-out" title="축소">${icon("minus")}</button><button id="zoom-value" data-action="fit" title="화면에 맞추기">100%</button><button data-action="zoom-in" title="확대">${icon("plus")}</button><span></span><button data-action="fullscreen" title="전체 화면">${icon("maximize")}</button></div></footer></main>
<div id="toast" role="status"></div><div id="hover-preview" class="hover-preview" hidden></div><div id="modal-root"></div><input id="file-input" type="file" multiple hidden />`;
  refreshIcons();
  bind();
  requestAnimationFrame(scaleCanvas);
  loadFileRecords();
}
function blockHTML(b) {
  let content = "";
  const editable = (text, cls = "") =>
    `<div class="editable ${cls}" contenteditable="true" spellcheck="false" data-edit="text">${escape(text)}</div>`;
  if (b.type === "note")
    content = `<div class="note-label">${icon("sticky-note")}<span>${escape(b.label || "QUICK NOTE")}</span></div>${editable(b.text, "note-text")}<span class="note-corner"></span>`;
  if (b.type === "text") content = editable(b.text, b.role || "");
  if (["rect", "circle"].includes(b.type))
    content = editable(b.text || "내용을 입력하세요.", "shape-text");
  if (b.type === "table") {
    const rows = b.cells || [
      ["할 일", "상태", "비고"],
      ["자료 정리", "진행 중", ""],
      ["아이디어 모으기", "예정", ""],
      ["함께 검토하기", "예정", ""],
    ];
    content = `<div class="table-scroll"><table>${rows.map((row, r) => `<tr>${row.map((cell, c) => `<${r === 0 ? "th" : "td"} contenteditable="true" data-cell="${r},${c}">${escape(cell)}</${r === 0 ? "th" : "td"}>`).join("")}</tr>`).join("")}</table></div>`;
  }
  if (b.type === "file") {
    const [ico, bg, color] = fileStyle(b.name);
    content = `<button class="file-open" data-file="${b.fileId}" title="${escape(b.sourcePath || b.name)}"><span class="file-type" style="background:${bg};color:${color}">${icon(ico)}</span><span class="file-details"><strong>${escape(b.name)}</strong><small id="mode-${b.id}">${window.moaDesktop ? "바로가기 · 원본 파일 열기" : "마우스를 올려 미리보기"}</small></span>${icon("arrow-up-right")}</button>${window.moaDesktop ? `<button class="file-preview-action" data-preview-file="${b.fileId}" title="미리보기">${icon("eye")}</button>` : ""}`;
  }
  return `<article class="block block-${b.type} ${b.role || ""}" data-id="${b.id}" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;transform:rotate(${Number(b.rotation) || 0}deg);--block-color:${b.color}"><button class="drag-handle" title="드래그하여 이동" aria-label="블록 이동">${icon("grip")}</button>${content}<button class="rotate-handle" title="드래그하여 회전 (15도 간격)" aria-label="블록 회전">${icon("rotate-cw")}</button><button class="resize-handle" title="크기 조절" aria-label="블록 크기 조절"></button></article>`;
}
function bind() {
  document
    .querySelectorAll("[data-add]")
    .forEach((el) => (el.onclick = () => addBlock(el.dataset.add)));
  document
    .querySelectorAll("[data-page]")
    .forEach((el) => (el.onclick = () => switchPage(el.dataset.page)));
  document
    .querySelectorAll("[data-action]")
    .forEach((el) => (el.onclick = () => action(el.dataset.action)));
  document.querySelectorAll("[data-menu]").forEach(
    (el) =>
      (el.onclick = (e) => {
        e.stopPropagation();
        const menu = $(`#${el.dataset.menu}-menu`);
        const open = menu.classList.contains("open");
        document
          .querySelectorAll(".menu")
          .forEach((m) => m.classList.remove("open"));
        menu.classList.toggle("open", !open);
      }),
  );
  $("#page-title").oninput = (e) => {
    page().title = e.target.value;
    persist();
  };
  $("#page-title").onblur = () => {
    if (!page().title.trim()) {
      page().title = "제목 없는 페이지";
      $("#page-title").value = page().title;
      persist();
    }

    const nav = document.querySelector(".page-item.current>span");
    if (nav) nav.textContent = page().title;
    document.title = page().title + " · 모아";
  };
  $("#page-title").onkeydown = (e) => {
    if (e.key === "Enter") e.target.blur();
  };
  $("#file-input").onchange = (e) => registerFiles([...e.target.files]);
  $("#canvas").addEventListener("pointerdown", onCanvasPointer);
  $("#canvas").addEventListener("input", (e) => {
    const block = page().blocks.find(
      (b) => b.id === e.target.closest(".block")?.dataset.id,
    );
    if (!block) return;
    if (e.target.dataset.edit) block.text = e.target.innerText;
    if (e.target.dataset.cell) {
      if (!block.cells)
        block.cells = [
          ["할 일", "상태", "비고"],
          ["자료 정리", "진행 중", ""],
          ["아이디어 모으기", "예정", ""],
          ["함께 검토하기", "예정", ""],
        ];
      const [r, c] = e.target.dataset.cell.split(",").map(Number);
      block.cells[r][c] = e.target.innerText;
    }
    persist();
  });
  $("#canvas").addEventListener("paste", (e) => {
    if (!e.target.closest("[contenteditable]")) return;
    e.preventDefault();
    document.execCommand(
      "insertText",
      false,
      e.clipboardData.getData("text/plain"),
    );
  });
  $("#canvas").addEventListener("click", (e) => {
    const f = e.target.closest("[data-file]");
    if (f) openRegisteredFile(f.dataset.file);
    const preview = e.target.closest("[data-preview-file]");
    if (preview) openPreview(preview.dataset.previewFile);
  });
  $("#canvas").addEventListener("pointerover", (e) => {
    const f = e.target.closest("[data-file]");
    if (f && !f.contains(e.relatedTarget)) {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => showHover(f), 500);
    }
  });
  $("#canvas").addEventListener("pointerout", (e) => {
    if (
      e.target.closest("[data-file]") &&
      !e.target.closest("[data-file]").contains(e.relatedTarget)
    ) {
      clearTimeout(hoverTimer);
      hideHover();
    }
  });
  $("#viewport").ondragover = (e) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      $("#viewport").classList.add("dragging");
    }
  };
  $("#viewport").ondragleave = () =>
    $("#viewport").classList.remove("dragging");
  $("#viewport").ondrop = (e) => {
    e.preventDefault();
    $("#viewport").classList.remove("dragging");
    const bounds = $("#canvas").getBoundingClientRect();
    const dropped = [...e.dataTransfer.files];
    const handles = window.moaDesktop ? [] : [...e.dataTransfer.items].map(i => i.getAsFileSystemHandle?.());
    const position = {
      x: snap((e.clientX - bounds.left) / zoom),
      y: snap((e.clientY - bounds.top) / zoom),
    };
    if (window.moaDesktop) registerFiles(dropped, position);
    else Promise.all(handles).then(async resolved => {
      const records = [];
      for (let i = 0; i < dropped.length; i++) {
        const handle = resolved[i];
        records.push(handle?.kind === "file" ? { file: dropped[i], handle } : dropped[i]);
      }
      return registerFiles(records, position);
    }).catch(() => registerFiles(dropped, position));
  };
  $(".brand").onclick = (e) => {
    e.preventDefault();
    switchPage(state.pages[0].id);
  };
  $(".workspace-switch").onclick = () =>
    toast("개인 워크스페이스입니다. 변경사항은 이 브라우저에 저장됩니다.");
}
function scaleCanvas() {
  const p = page(),
    v = $("#viewport");
  if (!v) return;
  zoom =
    manualZoom ??
    fitScale(
      p,
      Math.max(100, v.clientWidth - 24),
      Math.max(300, v.clientHeight - 50),
    );
  $("#canvas").style.transform = `scale(${zoom})`;
  $("#canvas-space").style.width = `${p.width * zoom}px`;
  $("#canvas-space").style.height = `${p.height * zoom}px`;
  $("#zoom-value").textContent = `${Math.round(zoom * 100)}%`;
}
function switchPage(id) {
  selected = null;
  active = id;
  state.active = id;
  manualZoom = null;
  render();
  persist();
}
function addBlock(type) {
  document
    .querySelectorAll(".menu")
    .forEach((el) => el.classList.remove("open"));
  const p = page();
  const n = p.blocks.filter((b) => b.type === type).length;
  const b = clampBlock(
    makeBlock(type, 70 + (n % 5) * 30, 80 + (n % 7) * 40),
    p,
  );
  b.x = snap(b.x); b.y = snap(b.y);
  b.w = snap(b.w); b.h = snap(b.h);
  clampBlock(b, p);
  p.blocks.push(b);
  selected = b.id;
  renderBlocks();
  $("#viewport").scrollTop = Math.max(0, b.y * zoom - 65);
  persist();
  toast(
    `${{ text: "텍스트", note: "메모", table: "표", rect: "사각형", circle: "원", hline: "가로 구분선", vline: "세로 구분선" }[type]} 추가됨`,
  );
}
function renderBlocks() {
  const footer = $(".canvas-footer").outerHTML;
  $("#canvas").innerHTML = page().blocks.map(blockHTML).join("") + footer;
  refreshIcons();
  selectBlock(selected);
}
function selectBlock(id) {
  selected = id;
  document
    .querySelectorAll(".block")
    .forEach((el) => el.classList.toggle("selected", el.dataset.id === id));
  const b = page().blocks.find((b) => b.id === id);
  const box = $("#selection-tools");
  if (!b) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = `<div class="block-controls"><span>${{ text: "텍스트", note: "메모", table: "표", rect: "사각형", circle: "원", hline: "가로 구분선", vline: "세로 구분선", file: "파일" }[b.type]}</span>${["note", "rect", "circle"].includes(b.type) ? colors.map((c) => `<button class="swatch ${b.color === c ? "picked" : ""}" style="background:${c}" data-color="${c}" title="색상 ${c}"></button>`).join("") : ""}${b.type === "table" ? `<button data-block-action="row" title="행 추가">+ 행</button><button data-block-action="column" title="열 추가">+ 열</button><button data-block-action="remove-row" title="마지막 행 삭제">− 행</button><button data-block-action="remove-column" title="마지막 열 삭제">− 열</button>` : ""}<label class="rotation-label">회전 <input id="rotation-angle" aria-label="회전 각도" type="number" min="-360" max="360" step="15" value="${b.rotation || 0}"/>°</label><button data-block-action="rotate" title="90도 회전">${icon("rotate-cw")}</button><button data-block-action="duplicate" title="복제">${icon("copy")}</button><button data-block-action="delete" title="삭제" class="danger">${icon("trash-2")}</button></div>`;
  refreshIcons();
  $("#rotation-angle").onchange = (e) => {
    b.rotation = (Number(e.target.value) || 0) % 360;
    clampBlock(b, page());
    renderBlocks(); persist();
  };
  box.querySelectorAll("[data-color]").forEach(
    (el) =>
      (el.onclick = () => {
        b.color = el.dataset.color;
        renderBlocks();
        persist();
      }),
  );
  box.querySelectorAll("[data-block-action]").forEach(
    (el) =>
      (el.onclick = () => {
        const a = el.dataset.blockAction;
        if (a === "rotate") { b.rotation = ((b.rotation || 0) + 90) % 360; clampBlock(b, page()); }
        if (a === "delete") {
          page().blocks = page().blocks.filter((x) => x.id !== b.id);
          selected = null;
        }
        if (a === "duplicate") {
          const copy = clampBlock(
            { ...structuredClone(b), id: uid(), x: snap(b.x + 40), y: snap(b.y + 40) },
            page(),
          );
          page().blocks.push(copy);
          selected = copy.id;
        }
        if (["row", "column", "remove-row", "remove-column"].includes(a)) {
          b.cells ??= [
            ["할 일", "상태", "비고"],
            ["자료 정리", "진행 중", ""],
            ["아이디어 모으기", "예정", ""],
            ["함께 검토하기", "예정", ""],
          ];
          if (a === "row") b.cells.push(Array(b.cells[0].length).fill(""));
          if (a === "column")
            b.cells.forEach((r, i) => r.push(i === 0 ? "새 열" : ""));
          if (a === "remove-row" && b.cells.length > 1) b.cells.pop();
          if (a === "remove-column" && b.cells[0].length > 1)
            b.cells.forEach((r) => r.pop());
        }
        renderBlocks();
        persist();
      }),
  );
}
function onCanvasPointer(e) {
  const el = e.target.closest(".block");
  if (!el) {
    selectBlock(null);
    return;
  }
  const b = page().blocks.find((x) => x.id === el.dataset.id);
  selectBlock(b.id);
  const resize = e.target.closest(".resize-handle"),
    drag = e.target.closest(".drag-handle"),
    rotate = e.target.closest(".rotate-handle");
  if (!resize && !drag && !rotate) return;
  e.preventDefault();
  const start = {
    x: e.clientX,
    y: e.clientY,
    bx: b.x,
    by: b.y,
    w: b.w,
    h: b.h,
    rotation: b.rotation || 0,
  };
  const rect = el.getBoundingClientRect();
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const initialAngle = Math.atan2(e.clientY - center.y, e.clientX - center.x);
  el.setPointerCapture(e.pointerId);
  el.classList.add("moving");
  const move = (ev) => {
    const dx = (ev.clientX - start.x) / zoom,
      dy = (ev.clientY - start.y) / zoom;
    if (rotate) {
      const angle = Math.atan2(ev.clientY - center.y, ev.clientX - center.x);
      b.rotation = Math.round((start.rotation + (angle - initialAngle) * 180 / Math.PI) / 15) * 15;
    } else if (resize) {
      const local = rotatedDelta(dx, dy, start.rotation);
      b.w = Math.max(
        b.type === "vline" ? 8 : 80,
        snap(start.w + local.x),
      );
      b.h = Math.max(
        b.type === "hline" ? 8 : 36,
        snap(start.h + local.y),
      );
    } else {
      b.x = snap(start.bx + dx);
      b.y = snap(start.by + dy);
      clampBlock(b, page());
    }
    clampBlock(b, page());
    Object.assign(el.style, {
      transform: `rotate(${b.rotation || 0}deg)`,
      left: b.x + "px",
      top: b.y + "px",
      width: b.w + "px",
      height: b.h + "px",
    });
  };
  const up = () => {
    el.classList.remove("moving");
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
    selectBlock(b.id);
    persist();
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
}
async function action(a) {
  if (a === "register") return pickFiles();
  if (a === "link-folder") {
    if (!window.moaDesktop?.chooseFolder) {
      return toast("원본 바로가기는 ZIP을 풀고 ‘모아 실행.cmd’로 실행해 주세요.");
    }
    try {
      const result = await window.moaDesktop.chooseFolder();
      if (result.path) toast(`연결 폴더: ${result.path} · 이제 이 폴더의 파일을 끌어 놓으세요.`);
    } catch (e) { toast(e.message); }
    return;
  }
  if (a === "add-page") {
    const p = makePage(
      state.pages.length + 1,
      Math.max(800, window.screen.availWidth || 1160),
      Math.max(600, window.screen.availHeight || 760),
    );
    state.pages.push(p);
    switchPage(p.id);
    toast("새 페이지가 추가되었습니다.");
  }
  if (a === "prev-page" || a === "next-page") {
    const index = state.pages.indexOf(page()) + (a === "prev-page" ? -1 : 1);
    if (state.pages[index]) switchPage(state.pages[index].id);
  }
  if (a === "zoom-in" || a === "zoom-out") {
    manualZoom = Math.max(
      0.25,
      Math.min(2, zoom + (a === "zoom-in" ? 0.1 : -0.1)),
    );
    scaleCanvas();
  }
  if (a === "fit") {
    manualZoom = null;
    scaleCanvas();
  }
  if (a === "fullscreen") {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast("이 브라우저에서는 전체 화면을 사용할 수 없습니다.");
    }
  }
  if (a === "help") help();
  if (a === "files") fileLibrary();
  if (a === "dimensions") dimensionModal();
  if (a === "pages")
    toast(`내 작업 공간에 ${state.pages.length}개의 페이지가 있습니다.`);
}
async function pickFiles() {
  if (window.moaDesktop) {
    try {
      const records = await window.moaDesktop.pickFiles();
      await registerNativeRecords(records);
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if ("showOpenFilePicker" in window) {
    try {
      const handles = await window.showOpenFilePicker({ multiple: true });
      const records = [];
      for (const handle of handles) {
        const file = await handle.getFile();
        records.push({ file, handle });
      }
      await registerFiles(records);
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
      if (e.name !== "SecurityError") {
        toast("파일에 접근할 수 없습니다. 파일 업로드로 다시 시도해 주세요.");
      }
    }
  }
  $("#file-input").click();
}
async function registerNativeRecords(records, position) {
  let count = 0;
  for (const native of records) {
    const record = {
      id: uid(),
      name: native.name,
      mode: "desktop",
      desktopId: native.id,
      path: native.path,
    };
    await write("files", record);
    fileRecords.set(record.id, record);
    const b = clampBlock(
      makeBlock(
        "file",
        (position?.x ?? 60) + (count % 3) * 320,
        (position?.y ?? 100) + Math.floor(count / 3) * 100,
        { name: record.name, fileId: record.id, sourcePath: record.path },
      ),
      page(),
    );
    page().blocks.push(b);
    selected = b.id;
    count++;
  }
  renderBlocks();
  persist();
  if (count) toast(`${count}개 파일 바로가기 추가됨 · 원본 위치만 연결합니다.`);
}
async function registerFiles(items, position) {
  if (!items.length) return;
  if (window.moaDesktop) {
    try {
      await registerNativeRecords(
        await window.moaDesktop.registerDroppedFiles(items), position,
      );
    } catch (e) {
      toast(e.message || "파일 위치를 연결하지 못했습니다. 연결 폴더 또는 파일 연결 버튼을 사용해 주세요.");
    }
    return;
  }
  let count = 0;
  for (const item of items) {
    const file = item.file || item;
    const id = uid();
    const record = {
      id,
      name: file.name,
      mode: item.handle ? "linked" : "copy",
      ...(item.handle ? { handle: item.handle } : { file }),
    };
    try {
      await write("files", record);
      fileRecords.set(id, record);
      const b = clampBlock(
        makeBlock(
          "file",
          (position?.x ?? 60) + (count % 3) * 320,
          (position?.y ?? 100) + Math.floor(count / 3) * 100,
          { name: file.name, fileId: id },
        ),
        page(),
      );
      page().blocks.push(b);
      selected = b.id;
      count++;
    } catch {
      toast(`${file.name} 저장 실패: 브라우저 저장 공간을 확인해 주세요.`);
    }
  }
  renderBlocks();
  persist();
  if (count)
    toast(
      `${count}개 파일 등록됨 · ${items.some((i) => i.handle) ? "원본 파일 연결" : "등록 시점의 사본 보관"}`,
    );
}
async function loadFileRecords() {
  for (const p of state.pages)
    for (const b of p.blocks)
      if (b.type === "file" && !fileRecords.has(b.fileId)) {
        try {
          const record = await read("files", b.fileId);
          if (record) {
            fileRecords.set(b.fileId, record);
            const label = document.getElementById("mode-" + b.id);
            if (label)
              label.textContent =
                record.mode === "desktop"
                  ? "바로가기 · 원본 파일 열기"
                  : record.mode === "linked"
                    ? "원본 연결 · 마우스를 올려 미리보기"
                    : "파일 사본 · 마우스를 올려 미리보기";
          }
        } catch {}
      }
}
async function recordFor(id) {
  return fileRecords.get(id) || (await read("files", id));
}
function hideHover() {
  previewToken++;
  const el = $("#hover-preview");
  if (el) {
    el.hidden = true;
    el.innerHTML = "";
  }
}
async function showHover(target) {
  const token = ++previewToken;
  const el = $("#hover-preview");
  if (!el) return;
  const rect = target.getBoundingClientRect();
  el.hidden = false;
  el.style.left =
    Math.max(12, Math.min(rect.left, window.innerWidth - 350)) + "px";
  el.style.top =
    Math.max(12, Math.min(rect.bottom + 10, window.innerHeight - 300)) + "px";
  el.innerHTML = '<div class="preview-loading">미리보기를 불러오는 중…</div>';
  try {
    const record = await recordFor(target.dataset.file);
    if (!record) throw Error("파일을 찾을 수 없습니다.");
    if (
      record.handle &&
      (await record.handle.queryPermission({ mode: "read" })) !== "granted"
    ) {
      if (token === previewToken)
        el.textContent = "클릭해서 파일 접근 권한을 허용해 주세요.";
      return;
    }
    const data = await previewFile(record);
    if (token !== previewToken) return;
    el.innerHTML = `<div class="hover-title">${icon("eye")}${escape(record.name)}<span>미리보기</span></div>${previewHTML(data, true)}<div class="hover-foot">${record.mode === "desktop" ? "클릭하면 원본 프로그램으로 열립니다" : "클릭하면 크게 볼 수 있어요"}</div>`;
    refreshIcons();
  } catch (e) {
    if (token === previewToken) el.textContent = e.message;
  }
}
function previewHTML(data, small = false) {
  if (data.type === "image")
    return `<img class="preview-image" src="${data.url}" alt="파일 미리보기"/>`;
  if (data.type === "pdf")
    return small
      ? `<div class="pdf-hover">${icon("file-text")}<strong>PDF 문서</strong><span>클릭하여 문서 미리보기</span></div>`
      : `<iframe class="pdf-frame" src="${data.url}" title="PDF 미리보기"></iframe>`;
  if (data.type === "sheets")
    return `<div class="sheet-preview">${data.sheets
      .slice(0, small ? 1 : 100)
      .map(
        (s) =>
          `<h4>${escape(s.name)}</h4><div class="sheet-scroll"><table>${s.rows
            .slice(0, small ? 5 : 60)
            .map(
              (row) =>
                `<tr>${row.map((c) => `<td>${escape(c)}</td>`).join("")}</tr>`,
            )
            .join("")}</table></div>`,
      )
      .join("")}</div>`;
  return `<div class="text-preview ${data.type === "unsupported" ? "unsupported" : ""}">${escape(small ? data.text.slice(0, 600) : data.text)}</div>`;
}
function modal(title, body, wide = false) {
  hideHover();
  $("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${escape(title)}"><header><div>${icon("layers")}<h2>${escape(title)}</h2></div><button class="icon-btn" id="close-modal" title="닫기">${icon("x")}</button></header>${body}</section></div>`;
  refreshIcons();
  $("#close-modal").onclick = closeModal;
  $(".modal-backdrop").onclick = (e) => {
    if (e.target === e.currentTarget) closeModal();
  };
  $("#close-modal").focus();
}
function closeModal() {
  $("#modal-root").innerHTML = "";
}
async function openRegisteredFile(id) {
  const record = await recordFor(id);
  if (record?.mode === "desktop" && window.moaDesktop) {
    try {
      await window.moaDesktop.openFile(record.desktopId);
      toast("연결 프로그램으로 파일을 열었습니다.");
    } catch (e) {
      toast(
        "원본 파일을 열 수 없습니다. 파일 위치와 연결 프로그램을 확인해 주세요.",
      );
    }
  } else if (record?.mode === "desktop") {
    toast("이 바로가기는 ‘모아 실행.cmd’로 실행한 화면에서 열어 주세요.");
  } else openPreview(id);
}
async function openPreview(id) {
  clearTimeout(hoverTimer);
  const record = await recordFor(id);
  if (!record) {
    toast("등록한 파일을 찾을 수 없습니다. 다시 등록해 주세요.");
    return;
  }
  modal(
    record.name,
    `<div class="preview-info"><span>${record.mode === "desktop" ? escape(record.path) : record.mode === "linked" ? "원본 파일 연결 · 변경된 내용 반영" : "등록 시점의 파일 사본"}</span><button class="secondary-btn" id="download-file">${icon("download")}파일 내려받기</button></div><div id="preview-body" class="preview-body">미리보기를 불러오는 중…</div><p class="preview-caption">${!window.moaDesktop ? "HTML 버전에서는 연결된 원본을 읽어 미리보기로 표시합니다. PC의 기본 연결 프로그램을 직접 실행할 수는 없습니다. " : ""}문서 미리보기는 텍스트·데이터 중심으로 표시됩니다. 원본의 서식과 배치는 다를 수 있습니다.</p>`,
    true,
  );
  $("#download-file").onclick = async () => {
    try {
      const file = await getFile(record);
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      toast(e.message);
    }
  };
  const previewBody = $("#preview-body");
  try {
    const data = await previewFile(record);
    if (previewBody.isConnected) {
      previewBody.innerHTML = previewHTML(data);
      refreshIcons();
    }
  } catch (e) {
    if (previewBody.isConnected)
      previewBody.textContent = `미리보기를 열 수 없습니다. ${e.message}`;
  }
}
function help() {
  modal(
    "모아 사용 가이드",
    `<div class="help-body"><div class="help-intro">업무를 가로로 넓게 펼쳐보세요.</div><p>상단 도구모음에서 메모, 표, 도형과 가로·세로 구분선을 추가합니다. 개체를 선택한 뒤 이동·크기 손잡이를 드래그하면 20px 격자에 맞춥니다. 회전 손잡이는 15도 간격이며 아래 도구모음에서 각도를 입력하거나 90도씩 회전할 수 있습니다.</p><h3>원본 파일을 바로가기로 연결</h3><p>Windows에서는 ZIP을 풀고 <strong>모아 실행.cmd</strong>를 실행하세요. 연결 도우미 창을 열어 두면 파일 카드 클릭 시 한글·Excel 등 PC 기본 프로그램으로 그 원본을 엽니다. 파일 내용을 내려받거나 사본으로 저장하지 않습니다.</p><p>파일 연결 버튼에서 원본을 선택하세요. 드래그하려면 먼저 연결 폴더를 지정하고 그 안의 파일을 끌어 놓으세요. 하위 폴더도 찾습니다. 같은 이름·크기·수정 시각을 가진 후보가 여러 개면 파일 연결 버튼으로 정확한 원본을 선택해야 합니다. 원본을 이동하거나 삭제하면 다시 연결해 주세요.</p><p>모아.html만 직접 열면 브라우저 미리보기 모드이며 PC 기본 프로그램 실행은 지원하지 않습니다. 지원 브라우저에서는 원본 핸들을, 그 외에는 등록 시점의 사본을 보관한다고 표시합니다.</p><h3>미리보기</h3><p>마우스를 올리거나 카드의 눈 버튼을 누르세요. 이미지, PDF, DOCX 본문, XLS/XLSX 셀, PPTX와 HWPX 텍스트를 표시합니다. HWP/DOC/PPT는 원본 프로그램에서 열어 주세요. 미리보기는 원본의 모든 서식을 재현하지 않습니다.</p><h3>페이지와 저장</h3><p>페이지 크기는 고정하고 가로폭에 맞춰 표시합니다. 긴 보드는 세로로 스크롤합니다. 작은 페이지 이름은 위쪽 경로에서 수정하고 아래 숫자 버튼으로 페이지를 이동하세요.</p><p>작업은 같은 브라우저에 자동 저장됩니다. HTML 직접 실행과 연결 도우미 화면은 저장 공간이 다릅니다. 사이트 데이터를 지우면 작업이 사라집니다. 클라우드 동기화는 제공하지 않습니다.</p></div>`,
  );
}
async function fileLibrary() {
  await loadFileRecords();
  const seen = new Set();
  const blocks = state.pages
    .flatMap((p) =>
      p.blocks
        .filter((b) => b.type === "file")
        .map((b) => ({ ...b, pageTitle: p.title, pageId: p.id })),
    )
    .filter((b) => !seen.has(b.fileId) && seen.add(b.fileId));
  modal(
    "파일 모아보기",
    `<div class="library-body"><p class="muted">모든 페이지에 연결된 파일 ${blocks.length}개</p>${
      blocks.length
        ? blocks
            .map((b) => {
              const [ico, bg, c] = fileStyle(b.name);
              return `<button class="library-file" data-library-file="${b.fileId}"><span class="file-type" style="background:${bg};color:${c}">${icon(ico)}</span><span><strong>${escape(b.name)}</strong><small>${escape(b.pageTitle)}</small></span>${icon("arrow-up-right")}</button>`;
            })
            .join("")
        : '<div class="empty-state">아직 등록한 파일이 없습니다.<br>파일 등록 버튼으로 첫 자료를 추가해 보세요.</div>'
    }</div>`,
  );
  document
    .querySelectorAll("[data-library-file]")
    .forEach(
      (b) => (b.onclick = () => openRegisteredFile(b.dataset.libraryFile)),
    );
}
function dimensionModal() {
  const p = page();
  modal(
    "페이지 크기 설정",
    `<form id="dimension-form" class="dimension-form"><p class="muted">페이지 크기는 저장 후 고정되며, 화면에는 비율을 유지해 표시됩니다.</p><div class="dimension-fields"><label>너비 (px)<input name="width" type="number" min="600" max="7680" required value="${p.width}"/></label><span>×</span><label>높이 (px)<input name="height" type="number" min="400" max="4320" required value="${p.height}"/></label></div><button type="button" class="secondary-btn" id="use-monitor">${icon("monitor")}현재 모니터에 맞추기</button><p class="muted">크기를 줄이면 블록 위치와 크기가 페이지 안으로 조정됩니다.</p><div class="form-footer"><button class="primary-btn" type="submit">크기 적용</button></div></form>`,
  );
  $("#use-monitor").onclick = () => {
    $("[name=width]").value = Math.max(600, Math.min(7680, screen.availWidth));
    $("[name=height]").value = Math.max(
      400,
      Math.min(4320, screen.availHeight),
    );
  };
  $("#dimension-form").onsubmit = (e) => {
    e.preventDefault();
    p.width = Number($("[name=width]").value);
    p.height = Number($("[name=height]").value);
    p.blocks.forEach((b) => clampBlock(b, p));
    manualZoom = null;
    render();
    persist();
    toast("페이지 크기를 적용했습니다.");
  };
}
window.addEventListener("resize", scaleCanvas);
document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown"))
    document
      .querySelectorAll(".menu")
      .forEach((el) => el.classList.remove("open"));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    hideHover();
    selectBlock(null);
  }
  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    selected &&
    !e.target.closest("input,textarea,[contenteditable]") &&
    !$(".modal")
  ) {
    e.preventDefault();
    page().blocks = page().blocks.filter((b) => b.id !== selected);
    selected = null;
    renderBlocks();
    persist();
  }
});
init().catch((e) => {
  $("#app").innerHTML =
    `<div class="startup-error"><h1>작업 공간을 열 수 없습니다</h1><p>브라우저의 사이트 데이터와 저장소 권한을 확인한 후 새로고침해 주세요.</p><p>${escape(e.message)}</p></div>`;
});

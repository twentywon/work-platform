import "./style.css";
import {makeBackup,readBackup} from "./backup.js";
import "./local-bridge.js";
import { blockNames, webURL, mediaKind, monthKey, shiftMonth, monthDays } from "./blocks.js";
import { createIcons, icons } from "lucide";
import { uid, makePage, makeBlock, fitScale, clampBlock, snap, rotatedDelta, drawerChildren, putInDrawer, takeOutOfDrawer, deleteBlock, duplicateBlock } from "./model.js";
import { read, write, getFile, allFiles, restoreWorkspace } from "./storage.js";
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
const mediaURLs = new Map();
let pickerPending = false;
let mediaParent = null;
let fileParent = null;
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
<main><header class="topbar"><div class="breadcrumb">워크스페이스 ${icon("chevron-right")}<input id="page-title" aria-label="페이지 이름" value="${escape(p.title)}" maxlength="70"/></div><div class="top-actions"><button id="connection-status" data-action="connection" class="connection-status">${window.moaDesktop?.nativeDropPaths ? "PC 원본 연결" : window.moaDesktop ? "브라우저 연결" : "미리보기 모드"}</button><button data-action="backup-menu" class="connection-status">백업·복원</button><span id="save-status">${icon("cloud-check")}모든 변경사항 저장됨</span><button class="icon-btn" data-action="help" title="사용 가이드">${icon("circle-help")}</button></div></header>
<section class="toolbar" aria-label="삽입 도구모음"><div class="toolbar-group"><button data-add="text">${icon("type")}<span>텍스트</span></button><button data-add="drawer">${icon("archive")}<span>서랍</span></button><button data-add="note">${icon("sticky-note")}<span>메모</span></button><button data-add="checkbox">${icon("square-check")}<span>체크박스</span></button><div class="dropdown"><button data-menu="extras">${icon("circle-plus")}<span>더 삽입</span>${icon("chevron-down")}</button><div class="menu" id="extras-menu"><button data-action="media">${icon("image")}<span>미디어</span></button><button data-add="calendar">${icon("calendar-days")}<span>달력</span></button><button data-action="web">${icon("globe")}<span>인터넷 링크</span></button><button data-action="pagelink">${icon("notebook-tabs")}<span>페이지 링크</span></button></div></div><button data-add="table">${icon("table-2")}<span>표</span></button><div class="dropdown"><button data-menu="shapes">${icon("shapes")}<span>도형</span>${icon("chevron-down")}</button><div class="menu" id="shapes-menu"><button data-add="rect">${icon("square")}사각형</button><button data-add="circle">${icon("circle")}원</button></div></div><div class="dropdown"><button data-menu="lines">${icon("columns-2")}<span>구분선</span>${icon("chevron-down")}</button><div class="menu" id="lines-menu"><button data-add="hline">${icon("minus")}가로 구분선</button><button data-add="vline">${icon("move-vertical")}세로 구분선</button></div></div></div><span class="toolbar-divider"></span><button class="link-tool" data-action="register">${icon("link")}<span>파일 연결</span></button><button class="link-tool" data-action="path-shortcut">${icon("clipboard-paste")}<span>경로 붙여넣기</span></button><div class="toolbar-right"><span>가로폭 맞춤 · 격자 20px</span>${icon("lock-keyhole")}<button class="dimensions" data-action="dimensions">${p.width} × ${p.height}</button></div></section>

<div class="canvas-viewport" id="viewport"><div class="canvas-space" id="canvas-space"><div class="canvas" id="canvas" style="width:${p.width}px;height:${p.height}px">${p.blocks.filter(b=>!b.parentId).map(b=>blockHTML(b)).join("")}<div class="canvas-footer"><span>MADE FOR YOUR IDEAS</span><span>MOA WORKSPACE · ${String(state.pages.indexOf(p) + 1).padStart(2, "0")}</span></div></div></div><div id="selection-tools"></div></div>
<footer class="bottom-bar"><span class="page-count">${state.pages.indexOf(p) + 1} / ${state.pages.length} 페이지</span><div class="pagination"><button data-action="prev-page" title="이전 페이지" ${state.pages.indexOf(p) === 0 ? "disabled" : ""}>${icon("chevron-left")}</button>${state.pages.map((x, i) => `<button data-page="${x.id}" class="${x.id === active ? "chosen" : ""}" aria-label="${i + 1}페이지">${i + 1}</button>`).join("")}<button data-action="next-page" title="다음 페이지" ${state.pages.indexOf(p) === state.pages.length - 1 ? "disabled" : ""}>${icon("chevron-right")}</button><span></span><button data-action="add-page" title="새 페이지">${icon("plus")}</button></div><div class="zoom-tools"><button data-action="zoom-out" title="축소">${icon("minus")}</button><button id="zoom-value" data-action="fit" title="화면에 맞추기">100%</button><button data-action="zoom-in" title="확대">${icon("plus")}</button><span></span><button data-action="fullscreen" title="전체 화면">${icon("maximize")}</button></div></footer></main>
<div id="toast" role="status"></div><div id="hover-preview" class="hover-preview" hidden></div><div id="modal-root"></div><input id="file-input" type="file" multiple hidden /><input id="backup-input" type="file" accept="application/json,.json" hidden/><input id="media-input" type="file" accept=".png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.avif,.mp4,.webm,.ogv,.mov,.m4v" multiple hidden />`;
  refreshIcons();
  bind();
  requestAnimationFrame(scaleCanvas);
  loadFileRecords();
  hydrateMedia();
}
function blockHTML(b, nested = false) {
  let content = "";
  const editable = (text, cls = "") =>
    `<div class="editable ${cls}" contenteditable="true" spellcheck="false" data-edit="text">${escape(text)}</div>`;
  if (b.type === "drawer") {
    const children=drawerChildren(page(),b.id);
    content=`<div class="drawer-header"><button data-drawer-toggle aria-expanded="${!!b.expanded}" aria-label="서랍 펼치기 또는 접기">${icon(b.expanded?"chevron-down":"chevron-right")}${icon("archive")}</button><input class="drawer-name" data-drawer-name aria-label="서랍 이름" value="${escape(b.name||"새 서랍")}"/><span>${children.length}개</span></div>${b.expanded ? `<div class="drawer-list">${children.map(child=>`<div class="drawer-entry"><div class="drawer-entry-tools"><span>${blockNames[child.type]}</span><button data-drawer-up="${child.id}" title="목록 위로">↑</button><button data-drawer-down="${child.id}" title="목록 아래로">↓</button><button data-drawer-out="${child.id}" title="보드로 꺼내기">${icon("arrow-up-right")}</button></div>${blockHTML(child,true)}</div>`).join("")||'<p class="drawer-empty">이 서랍에 개체를 넣어 보세요.</p>'}</div><div class="drawer-add"><button data-drawer-existing>개체 넣기</button><button data-drawer-file>파일</button><button data-drawer-media>이미지·GIF·영상</button><button data-drawer-note>메모</button><button data-drawer-check>체크</button></div>` : ""}`;
  }
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
  if (b.type === "checkbox")
    content = `<div class="check-item ${b.checked ? "done" : ""}"><input type="checkbox" data-check aria-label="할 일 완료" ${b.checked ? "checked" : ""}/>${editable(b.text)}</div>`;
  if (b.type === "media")
    content = `<div class="media-content" data-media="${b.fileId}"><span>미디어를 불러오는 중…</span></div><div class="media-caption">${escape(b.name)}</div>`;
  if (b.type === "web") {
    let url = "";
    try { url = webURL(b.url); } catch {}
    content = url ? `<a class="board-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${icon("globe")}<span><strong>${escape(b.text || new URL(url).hostname)}</strong><small>${escape(url)}</small></span>${icon("arrow-up-right")}</a>` : '<span>유효하지 않은 링크입니다. 링크 수정에서 주소를 변경하세요.</span>';
  }
  if (b.type === "pagelink") {
    const target = state.pages.find(p => p.id === b.targetPage);
    content = `<button class="board-link" data-board-page="${escape(b.targetPage)}" ${target ? "" : "disabled"}>${icon("file")}<span><strong>${escape(b.text || target?.title || "삭제된 페이지")}</strong><small>${escape(target?.title || "대상 페이지를 다시 지정하세요.")}</small></span>${icon("arrow-right")}</button>`;
  }
  if (b.type === "calendar") {
    const month = b.month || monthKey();
    const today = new Date();
    const todayKey = `${monthKey(today)}-${String(today.getDate()).padStart(2,"0")}`;
    content = `<div class="calendar-head"><button data-calendar-step="-1" aria-label="이전 달">${icon("chevron-left")}</button><input type="month" data-calendar-month aria-label="달력 월" min="1900-01" max="2200-12" value="${escape(month)}"/><button data-calendar-step="1" aria-label="다음 달">${icon("chevron-right")}</button><button data-calendar-today>오늘</button></div><div class="calendar-week">${["일","월","화","수","목","금","토"].map(d=>`<span>${d}</span>`).join("")}</div><div class="calendar-grid">${monthDays(month).map(date=>date ? `<button class="calendar-day ${date === todayKey ? "today" : ""} ${b.events?.[date] ? "has-event" : ""}" data-calendar-date="${date}" aria-label="${date} 일정"><span>${Number(date.slice(-2))}</span><small>${escape(b.events?.[date] || "")}</small></button>` : '<span></span>').join("")}</div>`;
  }
  if (b.type === "file") {
    const [ico, bg, color] = fileStyle(b.name);
    content = `<button class="file-open" data-file="${b.fileId}" title="${escape(b.sourcePath || b.name)}"><span class="file-type" style="background:${bg};color:${color}">${icon(ico)}</span><span class="file-details"><strong>${escape(b.name)}</strong><small id="mode-${b.id}">${window.moaDesktop ? "바로가기 · 원본 파일 열기" : "마우스를 올려 미리보기"}</small></span>${icon("arrow-up-right")}</button>${window.moaDesktop ? `<button class="file-preview-action" data-preview-file="${b.fileId}" title="미리보기">${icon("eye")}</button>` : ""}`;
  }
  return `<article class="block block-${b.type} ${b.role || ""} ${nested?'in-drawer':''}" data-id="${b.id}" style="left:${nested?0:b.x}px;top:${nested?0:b.y}px;width:${nested?'100%':b.w+'px'};height:${b.h}px;transform:rotate(${nested?0:Number(b.rotation)||0}deg);--block-color:${b.color}"><button class="drag-handle" title="드래그하여 이동" aria-label="블록 이동">${icon("grip")}</button>${content}${["top","right","bottom","left"].map(edge=>`<button class="select-edge edge-${edge}" aria-label="개체 테두리 선택 ${edge}" title="테두리를 눌러 선택"></button>`).join("")}<button class="rotate-handle" title="드래그하여 회전 (15도 간격)" aria-label="블록 회전">${icon("rotate-cw")}</button><button class="resize-handle" title="크기 조절" aria-label="블록 크기 조절"></button></article>`;
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
  $("#backup-input").onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try {const backup=readBackup(JSON.parse(await file.text()));clearTimeout(saveTimer);await restoreWorkspace(backup.state,backup.files);state=backup.state;active=state.active;selected=null;fileRecords.clear();closeModal();render();toast('작업을 복원했습니다.');}
    catch(error){toast(error.message);}
  };
  $("#media-input").onchange = e => { const parentId=mediaParent;mediaParent=null;registerMedia([...e.target.files],parentId); };
  $("#file-input").onchange = (e) => {
    const files = [...e.target.files];
    if (window.moaDesktop?.registerPaths) e.target.value = "";
    const parentId=fileParent;fileParent=null;
    registerFiles(files,parentId?{parentId}:undefined);
  };
  $("#canvas").addEventListener("pointerdown", onCanvasPointer);
  $("#canvas").addEventListener("input", (e) => {
    const block = page().blocks.find(
      (b) => b.id === e.target.closest(".block")?.dataset.id,
    );
    if (!block) return;
    if(e.target.matches('[data-drawer-name]'))block.name=e.target.value;
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
  $("#canvas").addEventListener("change", e => {
    const b = page().blocks.find(b => b.id === e.target.closest(".block")?.dataset.id);
    if (b && e.target.matches("[data-calendar-month]") && e.target.validity.valid && e.target.value) {
      b.month = e.target.value; renderBlocks(); persist();
    }
    if (b && e.target.matches("[data-check]")) {
      b.checked = e.target.checked;
      e.target.closest(".check-item").classList.toggle("done", b.checked);
      persist();
    }
  });
  $("#canvas").addEventListener("click", (e) => {
    const boardPage = e.target.closest("[data-board-page]");
    if (boardPage) return switchPage(boardPage.dataset.boardPage);
    const b = page().blocks.find(b => b.id === e.target.closest(".block")?.dataset.id);
    if (b?.type==='drawer') {
      if(e.target.closest('[data-drawer-toggle]')||e.target.closest('.drawer-header')&&!e.target.closest('input')) {
        if(b.expanded){b.openHeight=b.h;b.h=60;b.expanded=false;}
        else{b.expanded=true;b.h=b.openHeight||360;clampBlock(b,page());}
        renderBlocks();persist();return;
      }
      if(e.target.closest('[data-drawer-existing]'))return drawerChooser(b.id);
      if(e.target.closest('[data-drawer-file]')){if(window.moaDesktop&&!window.moaDesktop.nativeDropPaths)return nativePicker('file',{parentId:b.id});fileParent=b.id;$('#file-input').click();return;}
      if(e.target.closest('[data-drawer-media]')){mediaParent=b.id;$('#media-input').click();return;}
      if(e.target.closest('[data-drawer-note]')){addBlock('note',{parentId:b.id});return;}
      if(e.target.closest('[data-drawer-check]')){addBlock('checkbox',{parentId:b.id});return;}
    }
    const out=e.target.closest('[data-drawer-out]');
    if(out){takeOutOfDrawer(page(),out.dataset.drawerOut);renderBlocks();persist();return;}
    const up=e.target.closest('[data-drawer-up]'),down=e.target.closest('[data-drawer-down]');
    if(up||down){
      const childId=up?.dataset.drawerUp||down.dataset.drawerDown;
      const index=page().blocks.findIndex(x=>x.id===childId);
      const siblings=drawerChildren(page(),page().blocks[index].parentId);
      const adjacent=siblings[siblings.findIndex(x=>x.id===childId)+(up?-1:1)];
      if(adjacent){const other=page().blocks.indexOf(adjacent);[page().blocks[index],page().blocks[other]]=[page().blocks[other],page().blocks[index]];renderBlocks();persist();}
      return;
    }
    const step = e.target.closest("[data-calendar-step]");
    if (b && (step || e.target.closest("[data-calendar-today]"))) {
      b.month = step ? shiftMonth(b.month || monthKey(), Number(step.dataset.calendarStep)) : monthKey();
      renderBlocks(); persist(); return;
    }
    const date = e.target.closest("[data-calendar-date]");
    if (date && b) return calendarEvent(b, date.dataset.calendarDate);
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
    if (e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes("text/uri-list")) {
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
      parentId: e.target.closest('.block-drawer')?.dataset.id,
    };
    if (!dropped.length) {
      const address = e.dataTransfer.getData("text/uri-list").split(/\r?\n/).find(line => line && !line.startsWith("#"));
      if (address) {
        try { addBlock("web", { url: webURL(address), ...position }); } catch (error) { toast(error.message); }
      }
      return;
    }
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
function addBlock(type, extra = {}) {
  document
    .querySelectorAll(".menu")
    .forEach((el) => el.classList.remove("open"));
  const p = page();
  const n = p.blocks.filter((b) => b.type === type).length;
  const b = clampBlock(
    makeBlock(type, 70 + (n % 5) * 30, 80 + (n % 7) * 40, { ...(type === "calendar" ? { month: monthKey(), events: {} } : {}), ...extra }),
    p,
  );
  b.x = snap(b.x); b.y = snap(b.y);
  b.w = snap(b.w); b.h = snap(b.h);
  clampBlock(b, p);
  p.blocks.push(b);
  if(b.parentId)putInDrawer(p,[b.id],b.parentId);
  selected = b.id;
  renderBlocks();
  $("#viewport").scrollTop = Math.max(0, b.y * zoom - 65);
  persist();
  toast(
    `${blockNames[type]} 추가됨`,
  );
}
function renderBlocks() {
  const footer = $(".canvas-footer").outerHTML;
  $("#canvas").innerHTML = page().blocks.filter(b=>!b.parentId).map(b=>blockHTML(b)).join("") + footer;
  refreshIcons();
  selectBlock(selected);
  hydrateMedia();
}
function selectBlock(id) {
  selected = id;
  document
    .querySelectorAll(".block")
    .forEach((el) => {
      el.classList.toggle("selected", el.dataset.id === id);
      el.classList.toggle("contains-selected", !![...el.querySelectorAll('.block')].find(child=>child.dataset.id===id));
    });
  const b = page().blocks.find((b) => b.id === id);
  const box = $("#selection-tools");
  if (!b) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = `<div class="block-controls"><span>${blockNames[b.type]}</span>${["note", "rect", "circle"].includes(b.type) ? colors.map((c) => `<button class="swatch ${b.color === c ? "picked" : ""}" style="background:${c}" data-color="${c}" title="색상 ${c}"></button>`).join("") : ""}${b.type === "table" ? `<button data-block-action="row" title="행 추가">+ 행</button><button data-block-action="column" title="열 추가">+ 열</button><button data-block-action="remove-row" title="마지막 행 삭제">− 행</button><button data-block-action="remove-column" title="마지막 열 삭제">− 열</button>` : ""}${["web", "pagelink"].includes(b.type) ? '<button data-block-action="edit-link">링크 수정</button>' : ""}<label class="rotation-label">회전 <input id="rotation-angle" aria-label="회전 각도" type="number" min="-360" max="360" step="15" value="${b.rotation || 0}"/>°</label><button data-block-action="rotate" title="90도 회전">${icon("rotate-cw")}</button><button data-block-action="duplicate" title="복제">${icon("copy")}</button><button data-block-action="delete" title="삭제" class="danger">${icon("trash-2")}</button></div>`;
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
        if (a === "edit-link") return linkDialog(b.type, b);
        if (a === "rotate") { b.rotation = ((b.rotation || 0) + 90) % 360; clampBlock(b, page()); }
        if (a === "delete") {
          deleteBlock(page(),b.id);
          selected = null;
        }
        if (a === "duplicate") {
          const copy = duplicateBlock(page(),b.id);
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
  if(e.target.closest('.select-edge')){e.target.closest('.select-edge').focus();e.preventDefault();return;}
  if(b.parentId)return;
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
  document.querySelectorAll(".menu").forEach(el => el.classList.remove("open"));
  if (a === "backup-menu") return backupMenu();
  if (a === "connection") return connectionHelp();
  if (a === "media") { mediaParent=null;$("#media-input").click(); return; }
  if (a === "web" || a === "pagelink") return linkDialog(a);
  if (a === "register") return pickFiles();
  if (a === "path-shortcut") {
    if (!window.moaDesktop?.registerPaths) return connectionHelp();
    return pathDialog("file");
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
  fileParent=null;
  if(window.moaDesktop?.nativeDropPaths){$('#file-input').click();return;}
  if (window.moaDesktop) return nativePicker("file");
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
function backupMenu(){
  modal('작업 백업·복원',`<div class="connection-help"><p>전용 창과 기존 Chrome·Edge는 저장 공간이 다릅니다. 기존 브라우저에서 <strong>http://127.0.0.1:17843</strong>을 열고 백업한 뒤, 전용 창에서 같은 파일을 복원하세요.</p><p>백업에는 보드와 바로가기 경로, 보드에 넣은 미디어가 포함됩니다. 원본 문서는 복사하지 않습니다. 복원하면 현재 보드를 백업 내용으로 바꿉니다.</p><button class="primary-btn" id="export-backup">현재 작업 백업</button><button class="secondary-btn" id="import-backup">백업 파일 복원</button></div>`);
  $('#export-backup').onclick=async()=>{
    try {clearTimeout(saveTimer);await write('state',state,'workspace');const data=await makeBackup(state,await allFiles());const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='Moa-workspace-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
    catch(error){toast(error.message);}
  };
  $('#import-backup').onclick=()=>$('#backup-input').click();
}
function drawerChooser(drawerId) {
  const choices=page().blocks.filter(b=>!b.parentId&&b.id!==drawerId&&b.type!=='drawer');
  modal('서랍에 개체 넣기',`<form class="insert-form" id="drawer-form"><p>이 보드의 개체를 골라 서랍에 넣습니다.</p>${choices.map(b=>`<label class="drawer-choice"><input type="checkbox" name="members" value="${b.id}"/>${blockNames[b.type]} · ${escape(b.name||b.text||'개체').slice(0,90)}</label>`).join('')||'<p>보드에 개체를 먼저 추가하거나 서랍의 추가 버튼을 사용하세요.</p>'}<button type="submit" class="primary-btn">선택한 개체 넣기</button></form>`);
  $('#drawer-form').onsubmit=e=>{e.preventDefault();const ids=[...e.target.querySelectorAll('input:checked')].map(i=>i.value);putInDrawer(page(),ids,drawerId);closeModal();renderBlocks();persist();};
}
function pathDialog(kind, dropped = [], position, error = "") {
  modal("원본 파일 경로 붙여넣기", `<form id="path-form" class="insert-form"><p>탐색기에서 파일을 선택하고 Shift+마우스 오른쪽 클릭 → ‘경로로 복사’를 누르세요. 아래에 붙여넣으면 그 원본 위치를 연결합니다. 여러 파일 경로도 한 줄에 하나씩 입력할 수 있습니다.</p>${dropped.length ? `<p>선택한 파일: ${escape(dropped.map(f => f.name).join(", "))}</p>` : ""}<label>파일 전체 경로<textarea name="paths" rows="4" required placeholder="탐색기의 ‘경로로 복사’ 결과를 붙여넣으세요"></textarea></label><p id="path-error" role="alert">${escape(error)}</p><button type="submit" class="primary-btn" id="save-path">바로가기 추가</button><button type="button" class="secondary-btn" id="legacy-picker">Windows 파일 선택 창 사용</button><div id="linked-folders" class="muted"></div></form>`);
  $("#legacy-picker").onclick = () => nativePicker("file");
  $("#path-form").onsubmit = async e => {
    e.preventDefault();
    const form = e.target;
    const button = $("#save-path");
    button.disabled = true;
    $("#path-error").textContent = "원본 위치 확인 중…";
    try {
      const paths = form.elements.paths.value.split(/\r?\n/).map(p => p.trim().replace(/^"(.*)"$/, "$1")).filter(Boolean);
      if (!paths.length) throw Error("원본의 전체 경로를 입력해 주세요.");
      const records = await window.moaDesktop.registerPaths(paths);
      if (form.isConnected) closeModal();
      await registerNativeRecords(records, position);
    } catch (error) {
      if (form.isConnected) { $("#path-error").textContent = error.message; button.disabled = false; }
    }
  };
  if (window.moaDesktop.status) {
    const display = $("#linked-folders");
    window.moaDesktop.status().then(info => {
      if (display.isConnected) display.textContent = `도우미 v${info.version} · 폴더 지정 없이 파일 경로만 연결합니다.`;
    }).catch(e => { if (display.isConnected) display.textContent = e.message; });
  }
  $('[name="paths"]').focus();
}
async function nativePicker(kind, position, dropped = []) {
  if (pickerPending) return toast("이미 선택 창을 요청했습니다. Windows 선택 창을 확인해 주세요.");
  pickerPending = true;
  const label = "파일";
  modal(`${label} 선택 창 열기`, `<div class="connection-help" id="native-picker-wait"><p>Windows ${label} 선택 창을 요청했습니다.</p><p>브라우저 앞에 뜨는 창에서 ${label}을 선택해 주세요. 보이지 않으면 작업 표시줄 또는 <strong>Alt+Tab</strong>에서 ‘모아’ 선택 창을 확인해 주세요.</p><p class="muted">폴더를 미리 지정할 필요가 없습니다. ${dropped.length ? `끌어 놓은 파일(${escape(dropped.map(f => f.name).join(", "))})의 원본을 선택해 주세요.` : ""}</p>${window.moaDesktop.registerPaths ? '<button class="secondary-btn" id="picker-path-fallback">선택 창 대신 원본 경로 붙여넣기</button>' : ""}${window.moaDesktop.cancelSelection ? '<button class="secondary-btn" id="picker-cancel">선택 취소</button>' : ""}</div>`);
  if ($("#picker-cancel")) $("#picker-cancel").onclick = async () => {
    try { await window.moaDesktop.cancelSelection(); } catch {}
    if ($("#native-picker-wait")) closeModal();
  };
  if ($("#picker-path-fallback")) $("#picker-path-fallback").onclick = async () => {
    try { await window.moaDesktop.cancelSelection?.(); } catch {}
    pathDialog("file", [], position);
  };
  try {
    const records = await window.moaDesktop.pickFiles();
    if ($("#native-picker-wait")) closeModal();
    await registerNativeRecords(records, position);
    if (!records.length) toast("파일 선택을 취소했습니다.");
  } catch (error) {
    connectionHelp(error.message);
  } finally { pickerPending = false; }
}
async function connectionHelp(error) {
  const native = !!window.moaDesktop;
  modal(error ? "파일 연결을 완료하지 못했습니다" : "PC 파일 연결 상태", `<div class="connection-help"><p id="connection-detail" role="status">${error ? escape(error) : native ? "PC 연결 도우미로 실행 중입니다." : "현재는 HTML 미리보기 모드입니다. 원본 바로가기는 Windows 전용 창에서 사용하세요."}</p><ol><li>이전 모아 창과 검은 연결 도우미 창을 닫으세요.</li><li>최신 ZIP 전체를 압축 해제하고 <strong>모아 실행.vbs</strong>를 실행하세요.</li><li>검은 창 없이 열린 전용 창에서 탐색기 파일을 끌어놓거나 파일 연결을 누르세요. 폴더 연결과 추가 원본 확인 창은 필요하지 않습니다.</li><li>Microsoft Edge WebView2 Runtime이 없거나 오래되면 Microsoft 공식 버전으로 설치·업데이트하세요.</li></ol><p>기존 Chrome·Edge에서 <strong>http://127.0.0.1:17843</strong>을 열고 <strong>백업·복원</strong>으로 새 전용 창에 보드를 옮깁니다. 실행 오류는 메시지 창에, 연결 도우미 오류는 %LOCALAPPDATA%\\MoaWeb\\helper.log에 기록됩니다. 경로 붙여넣기도 사용할 수 있습니다.</p><button class="secondary-btn" id="connection-reload">이 화면 새로고침</button></div>`);
  $("#connection-reload").onclick = () => location.reload();
  const detail = $("#connection-detail");
  if (!error && window.moaDesktop?.status && !pickerPending) {
    try {
      const info = await window.moaDesktop.status();
      if (detail.isConnected) detail.textContent = `연결 정상 · 도우미 v${info.version} · 원본 파일 선택 가능`;
    } catch (e) { if (detail.isConnected) detail.textContent = e.message; }
  }
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
        { name: record.name, fileId: record.id, sourcePath: record.path, parentId:position?.parentId },
      ),
      page(),
    );
    page().blocks.push(b);
    if(b.parentId)putInDrawer(page(),[b.id],b.parentId);
    selected = b.id;
    count++;
  }
  if (count && $("#path-form")) closeModal();
  renderBlocks();
  persist();
  if (count) toast(`${count}개 파일 바로가기 추가됨 · 원본 위치만 연결합니다.`);
}
async function registerFiles(items, position) {
  if (!items.length) return;
  if(window.moaDesktop?.nativeDropUnavailable){connectionHelp('원본 경로 전달을 지원하는 최신 Microsoft Edge WebView2 Runtime이 필요합니다. 업데이트한 뒤 모아 전용 창을 다시 실행하세요.');return;}
  if(window.moaDesktop?.nativeDropPaths) {
    try { await registerNativeRecords(await window.moaDesktop.registerDroppedFiles(items),position); }
    catch(error){pathDialog('file',items,position,error.message);}
    return;
  }
  if (window.moaDesktop?.cancelSelection) { connectionHelp('확인 창 없이 파일을 끌어 놓으려면 ZIP의 모아 실행.vbs로 전용 창을 실행하세요. 일반 브라우저는 전체 원본 경로를 제공하지 않습니다.'); return; }
  if (window.moaDesktop) {
    try {
      await registerNativeRecords(
        await window.moaDesktop.registerDroppedFiles(items), position,
      );
    } catch (e) {
      if (window.moaDesktop.registerPaths) pathDialog("file", items, position, e.message);
      else toast(e.message || "파일 위치를 연결하지 못했습니다. 파일 연결 또는 경로 붙여넣기를 사용해 주세요.");
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
          { name: file.name, fileId: id, parentId:position?.parentId },
        ),
        page(),
      );
      page().blocks.push(b);
      if(b.parentId)putInDrawer(page(),[b.id],b.parentId);
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
    Math.max(12, Math.min(rect.bottom + 10, window.innerHeight - 370)) + "px";
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
  if (data.type === "page-image")
    return `<img class="page-preview" src="${data.url}" alt="${data.savedPreview ? "저장된 문서 미리보기" : "첫 페이지 이미지 미리보기"}"/><div class="preview-source">${escape(data.source)}</div>`;
  if (data.type === "image")
    return `<img class="preview-image" src="${data.url}" alt="파일 미리보기"/>`;
  if (data.type === "pdf")
    return small
      ? data.firstPage ? `<img class="page-preview" src="${data.firstPage}" alt="PDF 첫 페이지 이미지"/><div class="preview-source">PDF 첫 페이지</div>` : `<div class="pdf-hover">${icon("file-text")}<strong>PDF 문서</strong><span>${escape(data.imageUnavailable || "클릭하여 문서 미리보기")}</span></div>`
      : `<iframe class="pdf-frame" src="${data.url}" title="PDF 미리보기"></iframe>`;
  if (data.type === "sheets")
    return `${data.imageUnavailable ? `<div class="preview-fallback">첫 페이지 이미지를 표시하지 못해 표 데이터로 표시합니다. ${escape(data.imageUnavailable)}</div>` : ""}<div class="sheet-preview">${data.sheets
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
  return `${data.imageUnavailable ? `<div class="preview-fallback">첫 페이지 이미지를 표시하지 못해 텍스트로 표시합니다. ${escape(data.imageUnavailable)}</div>` : ""}<div class="text-preview ${data.type === "unsupported" ? "unsupported" : ""}">${escape(small ? data.text.slice(0, 600) : data.text)}</div>`;
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
      connectionHelp(e.message || "원본 파일을 열 수 없습니다. 파일 위치와 기본 연결 프로그램을 확인해 주세요.");
    }
  } else if (record?.mode === "desktop") {
    toast("이 바로가기는 ‘모아 실행.vbs’로 실행한 화면에서 열어 주세요.");
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
    `<div class="preview-info"><span>${record.mode === "desktop" ? escape(record.path) : record.mode === "linked" ? "원본 파일 연결 · 변경된 내용 반영" : "등록 시점의 파일 사본"}</span><button class="secondary-btn" id="download-file">${icon(record.mode === "desktop" ? "external-link" : "download")}${record.mode === "desktop" ? "원본 프로그램으로 열기" : "파일 내려받기"}</button></div><div id="preview-body" class="preview-body">미리보기를 불러오는 중…</div><p class="preview-caption">${!window.moaDesktop ? "HTML 버전에서는 연결된 원본을 읽어 미리보기로 표시합니다. PC의 기본 연결 프로그램을 직접 실행할 수는 없습니다. " : ""}PDF는 첫 페이지를 이미지로 표시합니다. 한글·Office는 저장된 미리보기 또는 설치된 프로그램을 사용하며, 이미지 생성이 지원되지 않으면 텍스트·표로 표시합니다.</p>`,
    true,
  );
  $("#download-file").onclick = async () => {
    if (record.mode === "desktop") return openRegisteredFile(id);
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
async function registerMedia(files,parentId) {
  for (const file of files) {
    const kind = mediaKind(file);
    if (!kind) { toast("이미지, GIF 또는 MP4·WebM 등의 영상을 선택해 주세요."); continue; }
    if (file.size > 100 * 1024 * 1024) { toast(`${file.name}: 보드 미디어는 파일당 100MB까지 지원합니다.`); continue; }
    try {
      const id = uid();
      await write("files", { id, name: file.name, mode: "copy", file });
      addBlock("media", { fileId: id, name: file.name, mediaKind: kind, parentId });
    } catch { toast("미디어를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요."); }
  }
  $("#media-input").value = "";
}
async function hydrateMedia() {
  const used = new Set(state.pages.flatMap(p => p.blocks.filter(b => b.type === "media").map(b => b.fileId)));
  for (const [id, url] of mediaURLs) if (!used.has(id)) { URL.revokeObjectURL(url); mediaURLs.delete(id); }
  for (const b of page().blocks.filter(b => b.type === "media")) {
    const target = [...document.querySelectorAll("[data-media]")].find(el => el.dataset.media === b.fileId && el.closest(".block").dataset.id === b.id);
    if (!target || target.querySelector("img,video")) continue;
    try {
      let url = mediaURLs.get(b.fileId);
      if (!url) {
        const record = await recordFor(b.fileId);
        if (!record) throw Error("미디어 파일을 다시 추가해 주세요.");
        const file = await getFile(record);
        url = mediaURLs.get(b.fileId) || URL.createObjectURL(file);
        mediaURLs.set(b.fileId, url);
      }
      if (!target.isConnected) continue;
      const media = document.createElement(b.mediaKind === "video" ? "video" : "img");
      if (b.mediaKind === "video") { media.controls = true; media.playsInline = true; media.preload = "metadata"; }
      else media.alt = b.name;
      media.onerror = () => { target.textContent = "이 미디어를 표시할 수 없습니다. 영상은 MP4(H.264) 또는 WebM 형식을 권장합니다."; };
      media.src = url;
      target.replaceChildren(media);
    } catch (e) { if (target.isConnected) target.textContent = e.message; }
  }
}
function linkDialog(type, existing) {
  const isWeb = type === "web";
  const options = state.pages.map(p => `<option value="${p.id}" ${p.id === existing?.targetPage ? "selected" : ""}>${escape(p.title)}</option>`).join("");
  modal(isWeb ? "인터넷 링크 추가" : "페이지 링크 추가", `<form id="link-form" class="insert-form"><label>표시 이름 (선택)<input name="label" maxlength="150" value="${escape(existing?.text || "")}" placeholder="비워두면 주소 또는 페이지 이름을 표시합니다"/></label>${isWeb ? `<label>인터넷 주소<input name="url" required value="${escape(existing?.url || "")}" placeholder="https://example.com"/></label>` : `<label>이동할 페이지<select name="target">${options}</select></label>`}<p id="link-error" role="alert"></p><button class="primary-btn" type="submit">${existing ? "수정" : "추가"}</button></form>`);
  $("#link-form").onsubmit = e => {
    e.preventDefault();
    const form = e.target;
    try {
      const fields = { text: form.elements.label.value.trim(), ...(isWeb ? { url: webURL(form.elements.url.value) } : { targetPage: form.elements.target.value }) };
      if (existing) { Object.assign(existing, fields); renderBlocks(); persist(); }
      else addBlock(type, fields);
      closeModal();
    } catch (error) { $("#link-error").textContent = error.message; }
  };
  $(isWeb ? '[name="url"]' : '[name="target"]').focus();
}
function calendarEvent(block, date) {
  modal(`${date} 일정`, `<form id="event-form" class="insert-form"><label>일정 또는 메모<textarea name="event" rows="5" maxlength="2000" placeholder="이 날짜에 할 일을 기록하세요.">${escape(block.events?.[date] || "")}</textarea></label><div class="event-actions"><button class="secondary-btn" type="button" id="delete-event">일정 삭제</button><button class="primary-btn" type="submit">저장</button></div></form>`);
  const save = text => {
    block.events ??= {};
    if (text.trim()) block.events[date] = text.trim(); else delete block.events[date];
    closeModal(); renderBlocks(); persist();
  };
  $("#event-form").onsubmit = e => { e.preventDefault(); save(e.target.elements.event.value); };
  $("#delete-event").onclick = () => save("");
  $('[name="event"]').focus();
}
function help() {
  modal(
    "모아 사용 가이드",
    `<div class="help-body"><div class="help-intro">업무를 가로로 넓게 펼쳐보세요.</div><p>상단 도구모음에서 메모, 표, 도형과 가로·세로 구분선을 추가합니다. 개체를 선택한 뒤 이동·크기 손잡이를 드래그하면 20px 격자에 맞춥니다. 회전 손잡이는 15도 간격이며 아래 도구모음에서 각도를 입력하거나 90도씩 회전할 수 있습니다.</p><h3>새 블록 삽입</h3><p>서랍을 추가하고 화살표를 눌러 펼치세요. 기존 개체를 담거나 파일·이미지·GIF·영상·메모·체크를 목록으로 추가하고 순서를 바꾸거나 꺼낼 수 있습니다. 개체 테두리를 클릭하면 선택됩니다.</p><p>체크박스에는 할 일과 완료 상태를 기록합니다. 더 삽입 메뉴에서 미디어·인터넷 링크·달력·페이지 링크를 추가하세요. 이미지와 GIF는 보드 안에 표시되고 영상은 재생 버튼으로 볼 수 있습니다. 미디어는 브라우저에 사본으로 저장하며 파일당 100MB까지 지원합니다. 달력 날짜를 누르면 일정 메모를 저장할 수 있습니다. 인터넷 링크는 새 탭으로, 페이지 링크는 해당 보드 페이지로 이동합니다.</p><h3>원본 파일을 바로가기로 연결</h3><p>Windows에서는 ZIP을 풀고 <strong>모아 실행.vbs</strong>를 실행하세요. 검은 창 없이 전용 HTML 창이 열리고 파일 카드 클릭 시 한글·Excel 등 PC 기본 프로그램으로 그 원본을 엽니다. 파일 내용을 내려받거나 사본으로 저장하지 않습니다.</p><p>전용 창에 파일을 끌어놓으면 원본 확인 창 없이 연결합니다. 파일 연결 버튼이나 경로 붙여넣기도 사용할 수 있습니다. 폴더를 미리 지정할 필요가 없습니다. 일반 브라우저에서는 드래그한 파일의 전체 경로를 받을 수 없습니다. 원본을 이동하거나 삭제하면 다시 연결해 주세요.</p><p>모아.html만 직접 열면 브라우저 미리보기 모드이며 PC 기본 프로그램 실행은 지원하지 않습니다. 지원 브라우저에서는 원본 핸들을, 그 외에는 등록 시점의 사본을 보관한다고 표시합니다.</p><h3>미리보기</h3><p>마우스를 올리거나 카드의 눈 버튼을 누르세요. PDF는 실제 첫 페이지를 이미지로 표시합니다. HWP/HWPX는 저장된 미리보기를, Word·Excel·PowerPoint는 저장된 이미지 또는 설치된 Office를 사용합니다. 미리보기가 지원되지 않으면 이유를 표시하고 텍스트·표로 전환합니다.</p><h3>페이지와 저장</h3><p>페이지 크기는 고정하고 가로폭에 맞춰 표시합니다. 긴 보드는 세로로 스크롤합니다. 작은 페이지 이름은 위쪽 경로에서 수정하고 아래 숫자 버튼으로 페이지를 이동하세요.</p><p>작업은 현재 창의 저장 공간에 자동 저장됩니다. 기존 Chrome·Edge와 새 전용 창, HTML 직접 실행은 저장 공간이 다릅니다. 백업·복원으로 옮기고 주기적으로 보관하세요. 사이트 데이터를 지우면 작업이 사라집니다. 클라우드 동기화는 제공하지 않습니다.</p></div>`,
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
    deleteBlock(page(),selected);
    selected = null;
    renderBlocks();
    persist();
  }
});
init().catch((e) => {
  $("#app").innerHTML =
    `<div class="startup-error"><h1>작업 공간을 열 수 없습니다</h1><p>브라우저의 사이트 데이터와 저장소 권한을 확인한 후 새로고침해 주세요.</p><p>${escape(e.message)}</p></div>`;
});

import {blockLink,setBlockLink,removeBlockLink,checkedLink} from './links.js';
import {checksFor,setChecks,migrateCheckBlocks,replaceLines,reconcileLines,lineMarkup,editorText,editorSelection,setEditorSelection} from "./line-editor.js";
import {tableCells} from "./table.js";
import {clipboardType,makeClipboard,readClipboard,pasteBlocks} from "./clipboard.js";
import cotionMark from "./assets/cotion.svg?raw";
import {shapes,isShape,shapeMarkup} from "./shapes.js";
import {EditHistory} from "./history.js";
import "./style.css";
import {fonts,textTypes,textStyle,appearanceStyle,hexColor} from "./format.js";
import {makeBackup,readBackup} from "./backup.js";
import "./local-bridge.js";
import { blockNames, webURL, mediaKind, monthKey, shiftMonth, monthDays } from "./blocks.js";
import {refreshIcons} from "./icons.js";
import { uid, makePage, makeBlock, fitScale, clampBlock, snap, rotatedDelta, drawerChildren, putInDrawer, takeOutOfDrawer, deleteBlocks, duplicateBlock, rotatedBounds, groupDelta, rotateBlock, reorderBlocks } from "./model.js";
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
let selectedIds=new Set();
let objectMenuPosition=null,editingLinkedId=null,objectClipboard=null;
const undoStack=[];
const editHistory=new EditHistory();
let cancelGesture=null,suppressBoardClick=false;
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
async function persist({history=true,mergeKey=""}={}) {
  if(history)editHistory.record(state,mergeKey);
  syncHistoryButtons();
  clearTimeout(saveTimer);
  $("#save-status").innerHTML = icon("loader-circle") + " 저장 중";
  refreshIcons($("#save-status"));
  saveTimer = setTimeout(async () => {
    try {
      await write("state", state, "workspace");
      $("#save-status").innerHTML =
        icon("circle-check") + " 모든 변경사항 저장됨";
    } catch {
      $("#save-status").textContent = "저장 실패 · 저장 공간을 확인해 주세요";
      toast("저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.");
    }
    refreshIcons($("#save-status"));
  }, 250);
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
          "코션에 오신 것을 환영합니다.\n\n상단 도구모음으로 메모, 표, 도형과 구분선을 추가해 보세요.\n블록을 클릭하면 나타나는 손잡이로 이동하고, 오른쪽 아래 모서리로 크기를 바꿀 수 있습니다.\n\n파일 연결: 지원하는 브라우저에서는 원본 파일을 연결합니다.\n권한을 다시 요청할 수 있으며, 파일을 이동하거나 삭제하면 재등록이 필요합니다.\n그 외 브라우저는 등록 시점의 파일 사본을 보관합니다.\n\n이 공간은 현재 브라우저에 자동 저장됩니다.",
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
  migrateCheckBlocks(state);
  active = state.active || state.pages[0].id;
  editHistory.reset(state);
  render();
}
function render() {
  const p = page();
  document.title = `${p.title} · 코션`;
  $("#app").innerHTML = `
<aside class="sidebar"><a class="brand" href="#" aria-label="코션 홈"><span class="brand-symbol">${cotionMark}</span><span class="brand-wordmark">코션</span></a>
<button class="workspace-switch"> <span class="workspace-avatar">나</span><span><strong>나의 워크스페이스</strong><small>Personal workspace</small></span>${icon("chevrons-up-down")}</button>
<div class="side-label">워크스페이스</div><button class="side-nav active" data-action="pages">${icon("layout-dashboard")}내 작업 공간<span>${state.pages.length}</span></button><button class="side-nav" data-action="files">${icon("folder-open")}파일 모아보기</button>
<div class="pages-header"><span>내 페이지</span><button class="icon-btn" data-action="add-page" title="새 페이지 추가">${icon("plus")}</button></div>
<nav class="page-nav">${state.pages.map((x, i) => `<button data-page="${x.id}" class="page-item ${x.id === active ? "current" : ""}">${icon("file")}<span>${escape(x.title)}</span>${x.id === active ? '<span class="current-dot"></span>' : ""}</button>`).join("")}</nav>
<button class="new-page" data-action="add-page">${icon("plus")}새 페이지 만들기</button>
<div class="side-bottom"><div class="tip-card"><span class="tip-icon">${icon("sparkles")}</span><strong>생각을 펼쳐보세요</strong><p>메모부터 파일까지,<br>모든 업무를 나만의 공간에.</p><button data-action="help">코션 사용 가이드 ${icon("arrow-up-right")}</button></div><div class="local-label">${icon("hard-drive")}이 브라우저에 안전하게 보관</div><button class="profile" data-action="help"><span class="profile-avatar">나</span><span>나의 공간<small>개인 워크스페이스</small></span>${icon("circle-help")}</button></div></aside>
<main><header class="topbar"><div class="breadcrumb">워크스페이스 ${icon("chevron-right")}<input id="page-title" aria-label="페이지 이름" value="${escape(p.title)}" maxlength="70"/></div><div class="top-actions"><button id="connection-status" data-action="connection" class="connection-status">${window.moaDesktop?.nativeDropPaths ? "PC 원본 연결" : window.moaDesktop ? "브라우저 연결" : "미리보기 모드"}</button><button data-action="backup-menu" class="connection-status">백업·복원</button><span id="save-status">${icon("circle-check")}모든 변경사항 저장됨</span><button class="icon-btn" data-action="help" title="사용 가이드">${icon("circle-help")}</button></div></header>
<section class="toolbar" aria-label="삽입 도구모음"><div class="toolbar-group"><button data-add="text">${icon("type")}<span>텍스트</span></button><button data-add="drawer">${icon("archive")}<span>서랍</span></button><button data-add="note">${icon("sticky-note")}<span>메모</span></button><button data-action="media">${icon("image")}<span>미디어</span></button><button data-add="calendar">${icon("calendar-days")}<span>달력</span></button><button data-action="link">${icon("link")}<span>링크</span></button><button data-add="table">${icon("table-2")}<span>표</span></button><div class="dropdown"><button data-menu="shapes">${icon("shapes")}<span>도형</span>${icon("chevron-down")}</button><div class="menu" id="shapes-menu">${Object.entries(shapes).map(([key,shape])=>`<button data-add="${key}">${icon(shape.icon)}${shape.name}</button>`).join('')}</div></div><div class="dropdown"><button data-menu="lines">${icon("columns-2")}<span>구분선</span>${icon("chevron-down")}</button><div class="menu" id="lines-menu"><button data-add="hline">${icon("minus")}가로 구분선</button><button data-add="vline">${icon("move-vertical")}세로 구분선</button></div></div></div><span class="toolbar-divider"></span><button class="link-tool" data-action="register">${icon("link")}<span>파일 연결</span></button><div class="toolbar-right"><span>가로폭 맞춤 · 격자 20px</span>${icon("lock-keyhole")}<button class="dimensions" data-action="dimensions">${p.width} × ${p.height}</button></div></section>
<div id="selection-tools" class="context-toolbar"></div>
<div class="canvas-viewport" id="viewport"><div class="canvas-space" id="canvas-space"><div class="canvas" id="canvas" tabindex="0" aria-label="업무 보드" style="width:${p.width}px;height:${p.height}px">${p.blocks.filter(b=>!b.parentId).map(b=>blockHTML(b)).join("")}<div class="canvas-footer"><span>MADE FOR YOUR IDEAS</span><span>COTION WORKSPACE · ${String(state.pages.indexOf(p) + 1).padStart(2, "0")}</span></div></div></div></div>
<footer class="bottom-bar"><span class="page-count">${state.pages.indexOf(p) + 1} / ${state.pages.length} 페이지</span><div class="pagination"><button data-action="prev-page" title="이전 페이지" ${state.pages.indexOf(p) === 0 ? "disabled" : ""}>${icon("chevron-left")}</button>${state.pages.map((x, i) => `<button data-page="${x.id}" class="${x.id === active ? "chosen" : ""}" aria-label="${i + 1}페이지">${i + 1}</button>`).join("")}<button data-action="next-page" title="다음 페이지" ${state.pages.indexOf(p) === state.pages.length - 1 ? "disabled" : ""}>${icon("chevron-right")}</button><span></span><button data-action="add-page" title="새 페이지">${icon("plus")}</button></div><div class="zoom-tools"><button data-action="zoom-out" title="축소">${icon("minus")}</button><button id="zoom-value" data-action="fit" title="화면에 맞추기">100%</button><button data-action="actual-size" title="원본 크기 (100%)">1:1</button><button data-action="zoom-in" title="확대">${icon("plus")}</button><span></span><button data-action="fullscreen" title="전체 화면">${icon("maximize")}</button></div></footer></main>
<div id="object-menu-root"></div><div id="toast" role="status"></div><div id="hover-preview" class="hover-preview" hidden></div><div id="modal-root"></div><input id="file-input" type="file" multiple hidden /><input id="backup-input" type="file" accept="application/json,.json" hidden/><input id="media-input" type="file" accept=".png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.avif,.mp4,.webm,.ogv,.mov,.m4v" multiple hidden />`;
  refreshIcons();
  bind();
  if(!selected)selectedIds.clear();
  renderSelection();
  requestAnimationFrame(scaleCanvas);
  loadFileRecords();
  hydrateMedia();
}
function blockHTML(b, nested = false) {
  let content = "";
  const editable = (text, cls = "") =>
    `<div class="editable ${cls}" contenteditable="${b.hyperlink&&editingLinkedId!==b.id?'false':'true'}" spellcheck="false" data-edit="text" style="${escape(textStyle(b.format||{}))}">${lineMarkup(text,checksFor(b),escape)}</div>`;
  if (b.type === "drawer") {
    const children=drawerChildren(page(),b.id);
    content=`<div class="drawer-header"><button data-drawer-toggle aria-expanded="${!!b.expanded}" aria-label="서랍 펼치기 또는 접기">${icon(b.expanded?"chevron-down":"chevron-right")}${icon("archive")}</button><input class="drawer-name" style="${escape(textStyle(b.format||{}))}" data-drawer-name aria-label="서랍 이름" value="${escape(b.name||"새 서랍")}"/><span>${children.length}개</span></div>${b.expanded ? `<div class="drawer-list">${children.map(child=>`<div class="drawer-entry"><div class="drawer-entry-tools"><span>${blockNames[child.type]}</span><button data-drawer-up="${child.id}" title="목록 위로">↑</button><button data-drawer-down="${child.id}" title="목록 아래로">↓</button><button data-drawer-out="${child.id}" title="보드로 꺼내기">${icon("arrow-up-right")}</button></div>${blockHTML(child,true)}</div>`).join("")||'<p class="drawer-empty">이 서랍에 개체를 넣어 보세요.</p>'}</div><div class="drawer-add"><button data-drawer-existing>개체 넣기</button><button data-drawer-file>파일</button><button data-drawer-media>이미지·GIF·영상</button><button data-drawer-note>메모</button></div>` : ""}`;
  }
  if (b.type === "note")
    content = `<div class="note-label">${icon("sticky-note")}<span>${escape(b.label || "QUICK NOTE")}</span></div>${editable(b.text, "note-text")}<span class="note-corner"></span>`;
  if (b.type === "text") content = editable(b.text, b.role || "");
  if (isShape(b.type))
    content = shapeMarkup(b.type)+editable(b.text || "내용을 입력하세요.", "shape-text");
  if (b.type === "table") {
    const rows = b.cells || [
      ["할 일", "상태", "비고"],
      ["자료 정리", "진행 중", ""],
      ["아이디어 모으기", "예정", ""],
      ["함께 검토하기", "예정", ""],
    ];
    content = `<div class="table-scroll"><table>${rows.map((row, r) => `<tr>${row.map((cell, c) => `<${r === 0 && b.tableHeader!==false ? "th" : "td"} contenteditable="${b.hyperlink&&editingLinkedId!==b.id?'false':'true'}" data-cell="${r},${c}" style="${escape(textStyle(b.format||{}))}">${lineMarkup(cell,checksFor(b,`${r},${c}`),escape)}</${r === 0 && b.tableHeader!==false ? "th" : "td"}>`).join("")}</tr>`).join("")}</table></div>`;
  }
  if (b.type === "media")
    content = `<div class="media-content" data-media="${b.fileId}"><span>미디어를 불러오는 중…</span></div><div class="media-caption">${escape(b.name)}</div>`;
  if (b.type === "web") {
    let url = "";
    try { url = webURL(b.url); } catch {}
    content = url ? `<a class="board-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${icon("globe")}<span style="${escape(textStyle(b.format||{}))}"><strong style="${escape(textStyle(b.format||{}))}">${escape(b.text || new URL(url).hostname)}</strong><small>${escape(url)}</small></span>${icon("arrow-up-right")}</a>` : '<span>유효하지 않은 링크입니다. 링크 수정에서 주소를 변경하세요.</span>';
  }
  if (b.type === "pagelink") {
    const target = state.pages.find(p => p.id === b.targetPage);
    content = `<button class="board-link" data-board-page="${escape(b.targetPage)}" ${target ? "" : "disabled"}>${icon("file")}<span style="${escape(textStyle(b.format||{}))}"><strong style="${escape(textStyle(b.format||{}))}">${escape(b.text || target?.title || "삭제된 페이지")}</strong><small>${escape(target?.title || "대상 페이지를 다시 지정하세요.")}</small></span>${icon("arrow-right")}</button>`;
  }
  if (b.type === "calendar") {
    const month = b.month || monthKey();
    const today = new Date();
    const todayKey = `${monthKey(today)}-${String(today.getDate()).padStart(2,"0")}`;
    content = `<div class="calendar-surface" style="--calendar-weeks:${monthDays(month).length/7}"><div class="calendar-head"><button data-calendar-step="-1" aria-label="이전 달">${icon("chevron-left")}</button><input type="month" data-calendar-month aria-label="달력 월" min="1900-01" max="2200-12" value="${escape(month)}"/><button data-calendar-step="1" aria-label="다음 달">${icon("chevron-right")}</button><button data-calendar-today>오늘</button></div><div class="calendar-week">${["일","월","화","수","목","금","토"].map(d=>`<span>${d}</span>`).join("")}</div><div class="calendar-grid">${monthDays(month).map(date=>date ? `<button class="calendar-day ${date === todayKey ? "today" : ""} ${b.events?.[date] ? "has-event" : ""}" data-calendar-date="${date}" aria-label="${date} 일정"><span>${Number(date.slice(-2))}</span><small>${escape(b.events?.[date] || "")}</small></button>` : '<span></span>').join("")}</div></div>`;
  }
  if (b.type === "file") {
    const [ico, bg, color] = fileStyle(b.name);
    content = `<button class="file-open" data-file="${b.fileId}" title="${escape(b.sourcePath || b.name)}"><span class="file-type" style="background:${bg};color:${color}">${icon(ico)}</span><span class="file-details"><strong style="${escape(textStyle(b.format||{}))}">${escape(b.caption||b.name)}</strong><small id="mode-${b.id}">${window.moaDesktop ? "바로가기 · 원본 파일 열기" : "마우스를 올려 미리보기"}</small></span>${icon("arrow-up-right")}</button>${window.moaDesktop ? `<button class="file-preview-action" data-preview-file="${b.fileId}" title="미리보기">${icon("eye")}</button>` : ""}`;
  }
  const linked=blockLink(b);
  const linkBadge=b.hyperlink?`<button class="object-link-badge" data-object-link aria-label="적용된 링크 열기" title="${escape(linked?.kind==='web'?linked.url:state.pages.find(p=>p.id===linked?.pageId)?.title||'삭제된 페이지')}">${icon('link')}</button>`:'';
  return `<article class="block ${b.hyperlink?'has-object-link':''} block-${b.type} ${b.role || ""} ${nested?'in-drawer':''} ${b.locked?'position-locked':''} ${isShape(b.type)?'block-shape':''}" data-id="${b.id}" style="left:${nested?0:b.x}px;top:${nested?0:b.y}px;width:${nested?'100%':b.w+'px'};height:${b.h}px;transform:rotate(${nested?0:Number(b.rotation)||0}deg);--block-color:${b.color};${appearanceStyle(b)}"><button class="drag-handle" title="드래그하여 이동" aria-label="블록 이동">${icon("grip")}</button>${content}${linkBadge}${["top","right","bottom","left"].map(edge=>`<button class="select-edge edge-${edge}" aria-label="개체 테두리 선택 ${edge}" title="테두리를 눌러 선택"></button>`).join("")}<button class="rotate-handle" title="드래그하여 회전 (15도 간격)" aria-label="블록 회전">${icon("rotate-cw")}</button><button class="resize-handle" title="크기 조절 (Shift: 비율 유지)" aria-label="블록 크기 조절"></button></article>`;
}
function bind() {
  document
    .querySelectorAll("[data-add]")
    .forEach((el) => (el.onclick = () => el.dataset.add==='table'?tableDialog():addBlock(el.dataset.add)));
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
    persist({mergeKey:"page-title:"+page().id});
  };
  $("#page-title").onblur = () => {
    if (!page().title.trim()) {
      page().title = "제목 없는 페이지";
      $("#page-title").value = page().title;
      persist();
    }

    const nav = document.querySelector(".page-item.current>span");
    if (nav) nav.textContent = page().title;
    document.title = page().title + " · 코션";
  };
  $("#page-title").onkeydown = (e) => {
    if (e.key === "Enter") e.target.blur();
  };
  $("#backup-input").onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try {const backup=readBackup(JSON.parse(await file.text()));clearTimeout(saveTimer);await restoreWorkspace(backup.state,backup.files);state=migrateCheckBlocks(backup.state);active=state.active;editHistory.reset(state);selected=null;selectedIds.clear();undoStack.length=0;fileRecords.clear();closeModal();render();toast('작업을 복원했습니다.');}
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
  $('#canvas').addEventListener('contextmenu',e=>{const block=e.target.closest('.block');if(block){e.preventDefault();openObjectMenu(block.dataset.id,e.clientX,e.clientY);}});
  $('#canvas').addEventListener('beforeinput',editBeforeInput);
  $('#canvas').addEventListener('wheel',drawerWheel,{passive:false});
  $('#canvas').addEventListener('click',e=>{
   const el=e.target.closest('.block'),b=page().blocks.find(b=>b.id===el?.dataset.id);
   if(!b?.hyperlink||e.target.closest('.select-edge,.drag-handle,.resize-handle,.rotate-handle,.drawer-entry-tools'))return;
   if(suppressBoardClick)return;
   if(editingLinkedId===b.id&&!e.target.closest('[data-object-link]'))return;
   e.preventDefault();e.stopImmediatePropagation();followBlockLink(b);
  },true);
  $('#canvas').addEventListener('focusin',e=>{const block=e.target.closest('.block');if(block&&!selectedIds.has(block.dataset.id))selectBlock(block.dataset.id);});
  $('#canvas').addEventListener('compositionend',e=>{if(e.target.matches('[data-edit],[data-cell]'))queueMicrotask(()=>syncTextEditor(e.target));});
  $("#canvas").addEventListener('click',e=>{if(suppressBoardClick){e.preventDefault();e.stopImmediatePropagation();suppressBoardClick=false;}},true);
  $("#canvas").addEventListener('dragstart',e=>{if(e.target.closest('.file-open,.board-link,.drag-handle,.select-edge'))e.preventDefault();});
  $("#canvas").addEventListener("input", (e) => {
    const block = page().blocks.find(
      (b) => b.id === e.target.closest(".block")?.dataset.id,
    );
    if (!block) return;
    if(e.target.matches('[data-drawer-name]'))block.name=e.target.value;
    if(e.target.matches('[data-edit],[data-cell]')){syncTextEditor(e.target,e.isComposing);return;}
    persist({mergeKey:"typing:"+block.id});
  });
  $("#canvas").addEventListener("paste", (e) => {
    if (!e.target.closest("[contenteditable]")) return;
    const root=e.target.closest('[data-edit],[data-cell]');
    if(root){e.preventDefault();replaceEditorSelection(root,e.clipboardData.getData('text/plain'));return;}
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
    if(b&&e.target.matches('[data-line-check]')) {
      const root=e.target.closest('[data-edit],[data-cell]'),cell=root.dataset.cell,checks=[...checksFor(b,cell)];
      checks[Number(e.target.dataset.lineCheck)]=e.target.checked;setChecks(b,cell,checks);
      e.target.closest('[data-text-line]').classList.toggle('line-done',e.target.checked);persist();return;
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
  // Layout zoom rerenders text at the target scale instead of stretching a transformed layer.
  $("#canvas").style.zoom = String(zoom);
  $("#canvas-space").style.width = `${p.width * zoom}px`;
  $("#canvas-space").style.height = `${p.height * zoom}px`;
  $("#zoom-value").textContent = `${Math.round(zoom * 100)}%`;
}
function switchPage(id) {
  editingLinkedId=null;
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
  if(!selected)selectedIds.clear();
  else if(!selectedIds.has(selected))selectedIds=new Set([selected]);
  selectedIds=new Set([...selectedIds].filter(id=>page().blocks.some(b=>b.id===id)));
  selected=selectedIds.has(selected)?selected:[...selectedIds].at(-1)||null;
  renderSelection();
  hydrateMedia();
}
function selectionBlocks() { return page().blocks.filter(b=>selectedIds.has(b.id)); }
function selectBlock(id, options={}) {
  if(options.toggle) {
    if(selectedIds.has(id))selectedIds.delete(id);else selectedIds.add(id);
  } else if(!options.preserve || !selectedIds.has(id)) selectedIds=new Set(id?[id]:[]);
  selected=id&&selectedIds.has(id)?id:[...selectedIds].at(-1)||null;
  renderSelection();
}
function renderSelection() {
  document.querySelectorAll('.block').forEach(el=>{
    el.classList.toggle('selected',selectedIds.has(el.dataset.id));
    el.classList.toggle('contains-selected',[...el.querySelectorAll('.block')].some(child=>selectedIds.has(child.dataset.id)));
  });
  contextToolbar();
}
function contextToolbar() {
 const box=$('#selection-tools'),menuRoot=$('#object-menu-root'),blocks=selectionBlocks(),b=blocks.find(b=>b.id===selected)||blocks[0];
 box.onwheel=e=>{if(e.deltaY&&!e.deltaX&&!e.target.closest('input,select')&&box.scrollWidth>box.clientWidth){box.scrollLeft+=e.deltaY;e.preventDefault();}};
 if(!b){closeObjectMenu();menuRoot.innerHTML='';box.innerHTML=historyButtons()+`<span class="selection-hint">여백 드래그로 여러 개체 선택 · Shift+클릭으로 추가 선택</span>${hasDeletionUndo()?'<button data-undo-delete>삭제 취소</button>':''}`;box.querySelector('[data-undo-delete]')?.addEventListener('click',undoDeletion);bindHistoryButtons();return;}
 const single=blocks.length===1;
 const canText=blocks.every(block=>textTypes.includes(block.type));
 const textElement=document.querySelector(`.block[data-id="${b.id}"] [data-edit],.block[data-id="${b.id}"] [data-cell],.block[data-id="${b.id}"] .file-details strong,.block[data-id="${b.id}"] .drawer-name,.block[data-id="${b.id}"] .board-link strong`);
 const computed=textElement?getComputedStyle(textElement):null;
 const format={font:'system',size:Math.round(parseFloat(computed?.fontSize)||14),bold:Number(computed?.fontWeight)>=600,italic:computed?.fontStyle==='italic',underline:computed?.textDecorationLine.includes('underline')||false,strike:computed?.textDecorationLine.includes('line-through')||false,align:computed?.textAlign||'left',...b.format};
 const choice=(prop,label,options,value)=>`<label>${label}<select data-prop="${prop}" aria-label="${label}">${options.map(([key,text])=>`<option value="${key}" ${String(value)===String(key)?'selected':''}>${text}</option>`).join('')}</select></label>`;
 const number=(prop,label,value,min,max,step=1)=>`<label>${label}<input data-prop="${prop}" aria-label="${label}" type="number" min="${min}" max="${max}" step="${step}" value="${Number.isFinite(Number(value))?Number(value):min}" ${b.locked&&['x','y','w','h'].includes(prop)?'disabled':''}/></label>`;
 const color=(prop,label,value)=>`<label>${label}<input data-prop="${prop}" aria-label="${label}" type="color" value="${hexColor(value)?value:'#303c50'}"/></label>`;
 const button=(action,title,content)=>`<button data-block-action="${action}" title="${title}" aria-label="${title}" ${['rotate','rotate-left','rotation-reset'].includes(action)&&b.locked?'disabled':''}>${content}</button>`;
 const drawers=page().blocks.filter(d=>d.type==='drawer'&&!selectedIds.has(d.id));
 box.innerHTML=historyButtons()+`<div class="block-controls" role="toolbar" aria-label="선택 개체 설정"><strong>${single?blockNames[b.type]:blocks.length+'개 선택'}</strong>
 ${canText?`${choice('text:font','글꼴',Object.entries(fonts).map(([key,v])=>[key,v[0]]),format.font)}${number('text:size','글자 크기',format.size,8,120)}${[['bold','굵게','<b>B</b>'],['italic','기울임','<i>I</i>'],['underline','밑줄','<u>U</u>'],['strike','취소선','<s>S</s>']].map(([key,label,content])=>`<button data-format-toggle="${key}" title="${label}" aria-label="${label}" aria-pressed="${!!format[key]}">${content}</button>`).join('')}<button data-line-toggle aria-label="줄 체크박스" title="커서가 있는 줄에 체크박스 적용/해제" ${single&&['text','note','table'].includes(b.type)||single&&isShape(b.type)?'':'disabled'}>${icon('square-check')}</button>${color('text:color','글자색',b.format?.color||'#303c50')}${choice('text:align','글자 정렬',[['left','왼쪽'],['center','가운데'],['right','오른쪽'],['justify','양쪽']],format.align)}${number('text:lineHeight','줄 간격',b.format?.lineHeight||1.8,1,3,.1)}<span class="control-divider"></span>`:''}
 ${single&&b.type==='table'?`${button('row','행 추가','+ 행')}${button('column','열 추가','+ 열')}${button('remove-row','마지막 행 삭제','− 행')}${button('remove-column','마지막 열 삭제','− 열')}`:''}
 ${single&&isShape(b.type)?choice('type','도형',Object.entries(shapes).map(([key,v])=>[key,v.name]),b.type):''}
 ${single&&['hline','vline'].includes(b.type)?`${choice('direction','구분선 방향',[['hline','가로'],['vline','세로']],b.type)}${color('lineColor','선 색',b.lineColor||'#8795ad')}${number('lineWidth','선 두께',b.lineWidth||1,1,20)}`:''}
 ${single&&['web','pagelink'].includes(b.type)?button('edit-link','링크 수정','링크 수정'):''}
 ${single&&b.type==='file'?`<label>표시 이름<input data-prop="caption" aria-label="파일 표시 이름" type="text" value="${escape(b.caption||b.name)}"/></label>${button('open-file',window.moaDesktop?'원본 파일 열기':'파일 미리보기','열기')}${button('preview','파일 미리보기','미리보기')}`:''}
 ${single&&b.type==='media'?`${choice('fit','미디어 맞춤',[['contain','전체 보기'],['cover','영역 채우기']],b.fit||'contain')}${b.mediaKind==='video'?`<label><input data-prop="videoLoop" type="checkbox" ${b.videoLoop?'checked':''}/>반복 재생</label><label><input data-prop="videoMuted" type="checkbox" ${b.videoMuted?'checked':''}/>음소거</label>`:''}`:''}
 ${single&&b.type==='calendar'?`<label>달력 월<input data-prop="month" aria-label="설정 달력 월" type="month" min="1900-01" max="2200-12" value="${escape(b.month||monthKey())}"/></label>`:''}
 ${single&&b.type==='drawer'?`<label>서랍 이름<input data-prop="name" aria-label="설정 서랍 이름" value="${escape(b.name||'새 서랍')}"/></label>${button('drawer-toggle',b.expanded?'서랍 접기':'서랍 펼치기',b.expanded?'접기':'펼치기')}${button('drawer-existing','기존 개체 넣기','개체 넣기')}`:''}
 ${color('fill','배경색',hexColor(b.background)?b.background:b.color)}${button('clear-fill','배경색 없애기','배경 없음')}${color('borderColor','테두리색',b.borderColor||'#b8c3d5')}${number('borderWidth','테두리 두께',b.borderWidth??1,0,12)}${number('opacity','불투명도',Math.round((b.opacity??1)*100),10,100)}
 </div>`;
 menuRoot.innerHTML=`<div id="object-context-menu" class="object-context-menu" role="menu" aria-label="개체 컨텍스트 메뉴" hidden><strong>${escape(single?blockNames[b.type]:blocks.length+'개 개체')}</strong>
 ${button('cut','잘라내기 (Ctrl+X)','잘라내기 <kbd>Ctrl+X</kbd>')}${button('copy','복사 (Ctrl+C)','복사 <kbd>Ctrl+C</kbd>')}<button data-block-action="paste-objects" ${objectClipboard?'':'disabled'} title="이 앱에서 복사한 개체를 붙여넣습니다. 외부 내용은 Ctrl+V를 사용하세요.">개체 붙여넣기 <kbd>Ctrl+V</kbd></button>
 ${single?`${button('attach-link',blockLink(b)?'링크 수정 (Ctrl+K)':'링크 삽입 (Ctrl+K)',icon('link')+(blockLink(b)?'링크 수정…':'링크 삽입…'))}${blockLink(b)?`${button('follow-link','링크 열기','링크 열기')}${button('remove-link','링크 제거','링크 제거')}`:''}${button('edit-content','내용 편집 (F2)','내용 편집 <kbd>F2</kbd>')}`:''}
 <strong>크기와 배치</strong>
 ${single&&!b.parentId?`${number('x','X',Math.round(b.x),0,page().width)}${number('y','Y',Math.round(b.y),0,page().height)}${number('w','너비',Math.round(b.w),b.type==='calendar'?220:20,page().width)}${number('h','높이',Math.round(b.h),b.type==='calendar'?180:8,page().height)}<label>회전<input id="rotation-angle" data-prop="rotation" aria-label="회전 각도" type="number" min="-360" max="360" step="15" value="${Number.isFinite(Number(b.rotation))?Number(b.rotation):0}" ${b.locked?'disabled':''}/>°</label>${button('rotate','오른쪽으로 90도 회전',icon('rotate-cw')+'오른쪽 90°')}${button('rotate-left','왼쪽으로 90도 회전','왼쪽 90°')}${button('rotation-reset','회전 초기화','회전 초기화')}`:''}


 <label><input data-prop="locked" aria-label="위치 잠금" type="checkbox" ${blocks.every(b=>b.locked)?'checked':''}/>위치 잠금</label>
 ${button('forward','한 단계 앞으로','한 단계 앞으로')}${button('backward','한 단계 뒤로','한 단계 뒤로')}${button('front','맨 앞으로','맨 앞으로')}${button('back','맨 뒤로','맨 뒤로')}
 ${drawers.length&&blocks.every(b=>b.type!=='drawer')?`<select data-put-drawer aria-label="선택 개체를 서랍에 넣기"><option value="">서랍에 넣기…</option>${drawers.map(d=>`<option value="${d.id}">${escape(d.name||'새 서랍')}</option>`).join('')}</select>`:''}
 ${single&&b.parentId?button('extract','보드로 꺼내기','꺼내기'):''}
 ${button('duplicate','복제',icon('copy')+'복제')}${button('delete',blocks.some(b=>b.type==='drawer')?'서랍과 내용 삭제':'삭제',icon('trash-2')+'삭제')}${hasDeletionUndo()?button('undo-delete','삭제 취소',icon('undo-2')+'삭제 취소'):''}</div>`;
 const controls={querySelectorAll:selector=>[...box.querySelectorAll(selector),...menuRoot.querySelectorAll(selector)],querySelector:selector=>box.querySelector(selector)||menuRoot.querySelector(selector)};
 refreshIcons();bindHistoryButtons();
 box.querySelector('[data-line-toggle]')?.addEventListener('pointerdown',e=>e.preventDefault());
 box.querySelector('[data-line-toggle]')?.addEventListener('click',toggleCurrentLine);
 if(objectMenuPosition?.id===selected)positionObjectMenu();else closeObjectMenu();
 controls.querySelectorAll('[data-format-toggle]').forEach(el=>el.onclick=()=>{const key=el.dataset.formatToggle;for(const b of blocks)b.format={...b.format,[key]:!format[key]};renderBlocks();persist();});
 controls.querySelectorAll('[data-prop]').forEach(el=>el.onchange=()=>{
  if(el.validity&&!el.validity.valid)return;
  const prop=el.dataset.prop;
  let value=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;
  if(el.type==='number'&&!Number.isFinite(value))return;
  for(const block of blocks) {
   if(prop.startsWith('text:'))block.format={...block.format,[prop.slice(5)]:value};
   else if(prop==='fill'){if(block.type==='note'||isShape(block.type)){block.color=value;delete block.background;}else block.background=value;}
   else if(prop==='opacity')block.opacity=value/100;
   else if(prop==='direction'){if(block.type!==value)[block.w,block.h]=[block.h,block.w];block.type=value;}
   else if(prop==='rotation'){if(!block.locked)rotateBlock(block,value);}
   else if(['x','y','w','h'].includes(prop)){if(!block.locked){block[prop]=value;clampBlock(block,page());}}
   else block[prop]=value;
  }
  renderBlocks();persist();
 });
 controls.querySelector('[data-put-drawer]')?.addEventListener('change',e=>{if(!e.target.value)return;putInDrawer(page(),blocks.map(b=>b.id),e.target.value);renderBlocks();persist();});
 controls.querySelectorAll('[data-block-action]').forEach(el=>el.onclick=()=>{
  const a=el.dataset.blockAction;
  if(a==='edit-link'||a==='attach-link')return linkDialog({block:b});
  if(a==='follow-link'){closeObjectMenu();return followBlockLink(b);}
  if(a==='remove-link'){removeBlockLink(b);editingLinkedId=null;renderBlocks();persist();return;}
  if(a==='edit-content'){closeObjectMenu();return editBlockContent(b);}
  if(a==='copy'||a==='cut')return copySelectedObjects(a==='cut');
  if(a==='paste-objects')return pasteObjectClipboard();
  if(a==='open-file')return openRegisteredFile(b.fileId);
  if(a==='preview')return openPreview(b.fileId);
  if(a==='drawer-existing')return drawerChooser(b.id);
  if(a==='drawer-toggle'){if(b.expanded){b.openHeight=b.h;b.h=60;b.expanded=false;}else{b.expanded=true;b.h=b.openHeight||360;clampBlock(b,page());}}
  if(a==='clear-fill')for(const block of blocks)block.background='transparent';
  if(a==='extract')takeOutOfDrawer(page(),b.id);
  if(a==='rotate'&&!b.locked)rotateBlock(b,(b.rotation||0)+90);
  if(a==='rotate-left'&&!b.locked)rotateBlock(b,(b.rotation||0)-90);
  if(a==='rotation-reset'&&!b.locked)rotateBlock(b,0);
  if(a==='delete')return deleteSelection();
  if(a==='undo-delete')return undoDeletion();
  if(a==='duplicate') {
   const roots=blocks.filter(block=>!selectedIds.has(block.parentId));
   const copies=roots.map(block=>duplicateBlock(page(),block.id));
   selectedIds=new Set(copies.map(c=>c.id));selected=copies.at(-1)?.id||null;
  }
  if(['front','back','forward','backward'].includes(a))reorderBlocks(page(),blocks.map(b=>b.id),a);
  if(['row','column','remove-row','remove-column'].includes(a)) {
   b.cells??=[['할 일','상태','비고'],['자료 정리','진행 중',''],['아이디어 모으기','예정',''],['함께 검토하기','예정','']];
   try{if(a==='row')tableCells(b.cells.length+1,b.cells[0].length);if(a==='column')tableCells(b.cells.length,b.cells[0].length+1);}catch(error){toast(error.message);return;}
   if(a==='row')b.cells.push(Array(b.cells[0].length).fill(''));
   if(a==='column')b.cells.forEach((row,i)=>row.push(i===0?'새 열':''));
   if(a==='remove-row'&&b.cells.length>1)b.cells.pop();
   if(a==='remove-column'&&b.cells[0].length>1)b.cells.forEach(row=>row.pop());
   if(b.cellChecks)for(const key of Object.keys(b.cellChecks)){const [r,c]=key.split(',').map(Number);if(r>=b.cells.length||c>=b.cells[0].length)delete b.cellChecks[key];}
  }
  renderBlocks();persist();
 });
}
function deleteSelection() {
 const entries=deleteBlocks(page(),[...selectedIds]);
 if(!entries.length)return;
 undoStack.push({pageId:page().id,entries});if(undoStack.length>20)undoStack.shift();
 selected=null;selectedIds.clear();renderBlocks();persist();toast(`${entries.length}개 개체 삭제됨 · 설정 줄에서 삭제 취소 가능`);
}
function undoDeletion() {
 const index=undoStack.findLastIndex(item=>item.pageId===page().id&&item.entries.some(({block})=>!page().blocks.some(b=>b.id===block.id)));if(index<0)return;
 const {entries}=undoStack.splice(index,1)[0];
 for(const {block,index} of entries)if(!page().blocks.some(b=>b.id===block.id))page().blocks.splice(Math.min(index,page().blocks.length),0,block);
 selectedIds=new Set(entries.filter(({block})=>!entries.some(e=>e.block.id===block.parentId)).map(e=>e.block.id));selected=[...selectedIds].at(-1)||null;
 renderBlocks();persist();toast('삭제한 개체를 복원했습니다.');
}
function boardPoint(clientX,clientY) {
 const rect=$('#canvas').getBoundingClientRect();
 return {x:(clientX-rect.left)/zoom,y:(clientY-rect.top)/zoom};
}
function consumeBoardClick() {suppressBoardClick=true;setTimeout(()=>suppressBoardClick=false,0);}
function pointerGesture(event,update,finish,shouldScroll=()=>true) {
 const canvas=$('#canvas'),viewport=$('#viewport');
 let last={clientX:event.clientX,clientY:event.clientY},frame,ended=false;
 const capture=event.target instanceof Element?event.target:canvas;
 capture.setPointerCapture(event.pointerId);
 const move=e=>{last={clientX:e.clientX,clientY:e.clientY};update(last);};
 const end=(e,cancelled=false)=>{
  if(ended)return;ended=true;cancelAnimationFrame(frame);
  canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);
  if(capture.hasPointerCapture(event.pointerId))capture.releasePointerCapture(event.pointerId);
  cancelGesture=null;finish(e||last,cancelled);
 };
 const up=e=>end(e),cancel=e=>end(e,true);
 const scroll=()=>{
  if(ended)return;
  if(!shouldScroll()){frame=requestAnimationFrame(scroll);return;}
  const rect=viewport.getBoundingClientRect();
  const dx=last.clientX<rect.left+25?-12:last.clientX>rect.right-25?12:0;
  const dy=last.clientY<rect.top+25?-12:last.clientY>rect.bottom-25?12:0;
  const x=viewport.scrollLeft,y=viewport.scrollTop;
  viewport.scrollLeft+=dx;viewport.scrollTop+=dy;
  if(x!==viewport.scrollLeft||y!==viewport.scrollTop)update(last);
  frame=requestAnimationFrame(scroll);
 };
 canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);
 cancelGesture=()=>end(null,true);frame=requestAnimationFrame(scroll);
}
function marqueeSelection(e) {
 e.preventDefault();hideHover();$('#canvas').focus({preventScroll:true});
 const start=boardPoint(e.clientX,e.clientY),previous=[...selectedIds];
 const base=e.shiftKey||e.ctrlKey||e.metaKey?previous:[];
 if(!base.length)selectBlock(null);
 const marker=document.createElement('div');marker.className='selection-marquee';$('#canvas').append(marker);
 const update=point=>{
  const end=boardPoint(point.clientX,point.clientY);
  const rect={left:Math.max(0,Math.min(start.x,end.x)),top:Math.max(0,Math.min(start.y,end.y)),right:Math.min(page().width,Math.max(start.x,end.x)),bottom:Math.min(page().height,Math.max(start.y,end.y))};
  Object.assign(marker.style,{left:rect.left+'px',top:rect.top+'px',width:Math.max(0,rect.right-rect.left)+'px',height:Math.max(0,rect.bottom-rect.top)+'px'});
  const hits=page().blocks.filter(b=>!b.parentId).filter(b=>{const r=rotatedBounds(b);return r.left<rect.right&&r.right>rect.left&&r.top<rect.bottom&&r.bottom>rect.top;}).map(b=>b.id);
  selectedIds=new Set([...base,...hits]);selected=[...selectedIds].at(-1)||null;renderSelection();
 };
 pointerGesture(e,update,(_event,cancelled)=>{marker.remove();if(cancelled){selectedIds=new Set(previous);selected=previous.at(-1)||null;renderSelection();}consumeBoardClick();});
}
function onCanvasPointer(e) {
 if(e.button!==0)return;
 const el=e.target.closest('.block');
 if(!el)return marqueeSelection(e);
 const b=page().blocks.find(b=>b.id===el.dataset.id);if(!b)return;
 const edge=e.target.closest('.select-edge'),resize=e.target.closest('.resize-handle'),rotate=e.target.closest('.rotate-handle'),grip=e.target.closest('.drag-handle');
 const drag=!!(edge||grip||e.target.closest('.file-open,.board-link')||!e.target.closest('button,input,select,textarea,[contenteditable],video'));
 if((e.shiftKey||e.ctrlKey||e.metaKey)&&!resize&&!rotate&&!grip&&!e.target.closest('[contenteditable],input,textarea,select')){selectBlock(b.id,{toggle:true});e.preventDefault();window.addEventListener('pointerup',()=>consumeBoardClick(),{once:true,capture:true});return;}
 selectBlock(b.id,{preserve:drag});
 if(edge||resize||rotate||grip)window.getSelection()?.removeAllRanges();
 if(edge){edge.focus();e.preventDefault();}
 if(b.parentId||b.locked||(!resize&&!rotate&&!drag))return;
 if((resize||rotate)&&selectedIds.size>1)selectBlock(b.id);
 const moving=selectionBlocks().filter(b=>!b.parentId&&!b.locked);
 if(!moving.length)return;
 e.preventDefault();(e.target.closest('button')||$('#canvas')).focus({preventScroll:true});clearTimeout(hoverTimer);hideHover();
 const start=boardPoint(e.clientX,e.clientY),snapshots=moving.map(b=>({...b}));
 const rect=el.getBoundingClientRect(),center={x:rect.x+rect.width/2,y:rect.y+rect.height/2};
 const initialAngle=Math.atan2(e.clientY-center.y,e.clientX-center.x),original=snapshots.find(block=>block.id===b.id);
 let moved=false,targetDrawer=null;
 const clearTarget=()=>document.querySelectorAll('.drawer-drop-target').forEach(el=>el.classList.remove('drawer-drop-target'));
 const update=point=>{
  const now=boardPoint(point.clientX,point.clientY),dx=now.x-start.x,dy=now.y-start.y;
  if(!moved&&Math.hypot(dx,dy)*zoom<4)return;
  moved=true;
  if(rotate) {
   const angle=Math.atan2(point.clientY-center.y,point.clientX-center.x);
   rotateBlock(b,Math.round(((original.rotation||0)+(angle-initialAngle)*180/Math.PI)/15)*15);
  } else if(resize) {
   const local=rotatedDelta(dx,dy,original.rotation||0);
   b.w=Math.max(b.type==='calendar'?220:b.type==='vline'?8:80,snap(original.w+local.x));b.h=Math.max(b.type==='calendar'?180:b.type==='hline'?8:36,snap(original.h+local.y));
   if(e.shiftKey){const ratio=original.w/original.h;if(Math.abs(local.x/original.w)>=Math.abs(local.y/original.h))b.h=b.w/ratio;else b.w=b.h*ratio;}clampBlock(b,page());
  } else {
   const delta=groupDelta(snapshots,page(),dx,dy);
   moving.forEach((block,i)=>{block.x=snapshots[i].x+delta.x;block.y=snapshots[i].y+delta.y;});
  }
  for(const block of moving) {
   const node=document.querySelector(`.block[data-id="${block.id}"]`);node.classList.add('moving');
   Object.assign(node.style,{left:block.x+'px',top:block.y+'px',width:block.w+'px',height:block.h+'px',transform:`rotate(${block.rotation||0}deg)`});
  }
  clearTarget();targetDrawer=null;
  if(!resize&&!rotate&&moving.some(b=>b.type!=='drawer')) {
   const candidate=document.elementsFromPoint(point.clientX,point.clientY).map(el=>el.closest('.block-drawer')).find(el=>el&&!selectedIds.has(el.dataset.id));
   if(candidate){targetDrawer=candidate.dataset.id;candidate.classList.add('drawer-drop-target');}
  }
 };
 pointerGesture(e,update,(_event,cancelled)=>{
  clearTarget();
  if(cancelled)moving.forEach((block,i)=>Object.assign(block,{x:snapshots[i].x,y:snapshots[i].y,w:snapshots[i].w,h:snapshots[i].h,rotation:snapshots[i].rotation}));
  if(moved&&!cancelled&&targetDrawer){const ids=moving.filter(b=>b.type!=='drawer').map(b=>b.id);putInDrawer(page(),ids,targetDrawer);toast(`${ids.length}개 개체를 서랍에 넣었습니다.`);}
  if(moved){consumeBoardClick();renderBlocks();if(!cancelled)persist();}
 },()=>moved);
}
async function action(a) {
  document.querySelectorAll(".menu").forEach(el => el.classList.remove("open"));
  if (a === "backup-menu") return backupMenu();
  if (a === "connection") return connectionHelp();
  if (a === "media") { mediaParent=null;$("#media-input").click(); return; }
  if(a==='link')return linkDialog();
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
  if (a === "actual-size") { manualZoom = 1; scaleCanvas(); }
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
  fileConnectDialog();
}
async function chooseOriginalFiles() {
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
    try {clearTimeout(saveTimer);await write('state',state,'workspace');const data=await makeBackup(state,await allFiles());const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='Cotion-workspace-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
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
  modal(`${label} 선택 창 열기`, `<div class="connection-help" id="native-picker-wait"><p>Windows ${label} 선택 창을 요청했습니다.</p><p>브라우저 앞에 뜨는 창에서 ${label}을 선택해 주세요. 보이지 않으면 작업 표시줄 또는 <strong>Alt+Tab</strong>에서 ‘코션’ 선택 창을 확인해 주세요.</p><p class="muted">폴더를 미리 지정할 필요가 없습니다. ${dropped.length ? `끌어 놓은 파일(${escape(dropped.map(f => f.name).join(", "))})의 원본을 선택해 주세요.` : ""}</p>${window.moaDesktop.registerPaths ? '<button class="secondary-btn" id="picker-path-fallback">선택 창 대신 원본 경로 붙여넣기</button>' : ""}${window.moaDesktop.cancelSelection ? '<button class="secondary-btn" id="picker-cancel">선택 취소</button>' : ""}</div>`);
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
  modal(error ? "파일 연결을 완료하지 못했습니다" : "PC 파일 연결 상태", `<div class="connection-help"><p id="connection-detail" role="status">${error ? escape(error) : native ? "PC 연결 도우미로 실행 중입니다." : "현재는 HTML 미리보기 모드입니다. 원본 바로가기는 Windows 전용 창에서 사용하세요."}</p><ol><li>이전 코션 창과 검은 연결 도우미 창을 닫으세요.</li><li>최신 ZIP 전체를 압축 해제하고 <strong>코션 실행.vbs</strong>를 실행하세요.</li><li>검은 창 없이 열린 전용 창에서 탐색기 파일을 끌어놓거나 파일 연결을 누르세요. 폴더 연결과 추가 원본 확인 창은 필요하지 않습니다.</li><li>Microsoft Edge WebView2 Runtime이 없거나 오래되면 Microsoft 공식 버전으로 설치·업데이트하세요.</li></ol><p>기존 Chrome·Edge에서 <strong>http://127.0.0.1:17843</strong>을 열고 <strong>백업·복원</strong>으로 새 전용 창에 보드를 옮깁니다. 실행 오류는 메시지 창에, 연결 도우미 오류는 %LOCALAPPDATA%\\MoaWeb\\helper.log에 기록됩니다. 경로 붙여넣기도 사용할 수 있습니다.</p><button class="secondary-btn" id="connection-reload">이 화면 새로고침</button></div>`);
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
  if(window.moaDesktop?.nativeDropUnavailable){connectionHelp('원본 경로 전달을 지원하는 최신 Microsoft Edge WebView2 Runtime이 필요합니다. 업데이트한 뒤 코션 전용 창을 다시 실행하세요.');return;}
  if(window.moaDesktop?.nativeDropPaths) {
    try { await registerNativeRecords(await window.moaDesktop.registerDroppedFiles(items),position); }
    catch(error){pathDialog('file',items,position,error.message);}
    return;
  }
  if (window.moaDesktop?.cancelSelection) { connectionHelp('확인 창 없이 파일을 끌어 놓으려면 ZIP의 코션 실행.vbs로 전용 창을 실행하세요. 일반 브라우저는 전체 원본 경로를 제공하지 않습니다.'); return; }
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
    toast("이 바로가기는 ‘코션 실행.vbs’로 실행한 화면에서 열어 주세요.");
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
  const targets = new Map([...document.querySelectorAll("[data-media]")].map(el => [el.closest(".block").dataset.id, el]));
  for (const b of page().blocks.filter(b => b.type === "media")) {
    const target = targets.get(b.id);
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
      if (b.mediaKind === "video") { media.controls = true; media.playsInline = true; media.preload = "metadata"; media.loop=!!b.videoLoop; media.muted=!!b.videoMuted; }
      else media.alt = b.name;
      media.onerror = () => { target.textContent = "이 미디어를 표시할 수 없습니다. 영상은 MP4(H.264) 또는 WebM 형식을 권장합니다."; };
      media.src = url;
      target.replaceChildren(media);
    } catch (e) { if (target.isConnected) target.textContent = e.message; }
  }
}
function linkDialog({block=null}={}) {
 closeObjectMenu();
 const current=block?blockLink(block):null,isCard=!block||['web','pagelink'].includes(block.type);
 const options=state.pages.map(p=>`<option value="${p.id}" ${p.id===current?.pageId?'selected':''}>${escape(p.title)}</option>`).join('');
 modal(block?'링크 설정':'링크 추가',`<form id="link-form" class="insert-form"><label>연결 종류<select name="kind" aria-label="연결 종류"><option value="web">인터넷 주소</option><option value="page">보드 페이지</option></select></label>${isCard?`<label>표시 이름 (선택)<input name="label" maxlength="150" value="${escape(block?.text||'')}" placeholder="비워두면 주소 또는 페이지 이름을 표시합니다"/></label>`:''}<label data-web-field>인터넷 주소<input name="url" value="${escape(current?.url||'')}" placeholder="https://example.com"/></label><label data-page-field>이동할 페이지<select name="target">${options}</select></label>${!isCard?'<p class="muted">개체를 클릭하면 이동합니다. 테두리·손잡이로 선택·이동하고 F2로 내용 편집, Esc로 편집을 끝냅니다.</p>':''}<p id="link-error" role="alert"></p><div class="form-footer"><button type="button" class="secondary-btn" data-link-cancel>취소</button><button class="primary-btn" type="submit">${block?'적용':'추가'}</button></div></form>`);
 const form=$('#link-form');form.elements.kind.value=current?.kind||'web';
 const update=()=>{const web=form.elements.kind.value==='web';form.querySelector('[data-web-field]').hidden=!web;form.querySelector('[data-page-field]').hidden=web;form.elements.url.required=web;};
 form.elements.kind.onchange=update;update();form.querySelector('[data-link-cancel]').onclick=closeModal;
 form.onsubmit=e=>{
  e.preventDefault();
  try {
   const link=checkedLink(form.elements.kind.value==='web'?{kind:'web',url:form.elements.url.value}:{kind:'page',pageId:form.elements.target.value});
   if(link.kind==='page'&&!state.pages.some(p=>p.id===link.pageId))throw Error('연결할 페이지를 선택해 주세요.');
   const label=form.elements.label?.value.trim();
   if(block){setBlockLink(block,link);if(isCard)block.text=label;editingLinkedId=null;closeModal();renderBlocks();persist();}
   else{closeModal();addBlock(link.kind==='web'?'web':'pagelink',{text:label,...(link.kind==='web'?{url:link.url}:{targetPage:link.pageId})});}
  }catch(error){$('#link-error').textContent=error.message;}
 };
 (current?.kind==='page'?form.elements.target:form.elements.url).focus();
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
    "코션 사용 가이드",
    `<div class="help-body"><div class="help-intro">업무를 가로로 넓게 펼쳐보세요.</div><p>상단 도구모음에서 메모, 표, 도형과 가로·세로 구분선을 추가합니다. 개체를 선택한 뒤 이동·크기 손잡이를 드래그하면 20px 격자에 맞춥니다. 회전 손잡이는 15도 간격이며 우클릭 메뉴에서 각도를 입력하거나 90도씩 회전할 수 있습니다.</p><p>개체를 우클릭하면 위치·크기·회전·잠금·앞뒤 순서·서랍 넣기·복제·삭제 메뉴가 열립니다. Shift+F10으로도 열고 Esc 또는 바깥 클릭으로 닫습니다. 표 버튼에서는 줄·칸 수와 표 크기, 제목 줄을 정합니다.</p><h3>Windows 단축키</h3><p>Ctrl+C/X/V 복사·잘라내기·붙여넣기, Ctrl+D 복제, Ctrl+Z 취소, Ctrl+Y 또는 Ctrl+Shift+Z 다시 실행, Ctrl+S 저장, Ctrl+N 새 페이지, Ctrl+O 파일 연결을 지원합니다. 텍스트에는 Ctrl+B/I/U 서식과 Ctrl+L/E/R 정렬을 적용합니다. 입력 중이 아닐 때 방향키는 1px, Shift+방향키는 10px 이동합니다.</p><h3>새 블록 삽입</h3><p>서랍을 추가하고 화살표를 눌러 펼치세요. 기존 개체를 담거나 파일·이미지·GIF·영상·메모를 목록으로 추가하고 순서를 바꾸거나 꺼낼 수 있습니다. 개체 테두리를 클릭하면 선택됩니다.</p><p>텍스트·메모·도형·표에서 커서를 놓고 취소선 옆 줄 체크박스를 누르면 그 줄에 체크를 붙입니다. 체크하면 자동 줄바꿈된 부분까지 해당 줄 전체에 취소선이 적용됩니다. Enter로 다음 체크 줄을 만들고 빈 체크 줄에서 Enter를 누르면 체크를 끝냅니다. 같은 서식 버튼으로 현재 줄의 체크를 제거합니다. 상단 도구모음에서 미디어·달력·링크를 추가하세요. 링크 창에서 인터넷 주소 또는 보드 페이지를 선택합니다. 개체 우클릭 → 링크 삽입 또는 Ctrl+K로 개체 자체에 링크를 걸고 클릭하면 이동합니다. F2로 내용을 편집하고 Esc로 편집을 끝냅니다. 새 도형은 처음에만 정비율이며 이후 가로·세로를 자유롭게 조절합니다. Shift를 누른 채 드래그할 때만 현재 비율을 유지합니다. 달력 글자는 크기에 따라 조절되고 날짜는 왼쪽 위에 표시합니다. 서랍 위 휠은 서랍 목록을 스크롤합니다. 이미지와 GIF는 보드 안에 표시되고 영상은 재생 버튼으로 볼 수 있습니다. 미디어는 브라우저에 사본으로 저장하며 파일당 100MB까지 지원합니다. 달력 날짜를 누르면 일정 메모를 저장할 수 있습니다. 인터넷 링크는 새 탭으로, 페이지 링크는 해당 보드 페이지로 이동합니다.</p><h3>원본 파일을 바로가기로 연결</h3><p>Windows에서는 ZIP을 풀고 <strong>코션 실행.vbs</strong>를 실행하세요. 검은 창 없이 전용 HTML 창이 열리고 파일 카드 클릭 시 한글·Excel 등 PC 기본 프로그램으로 그 원본을 엽니다. 파일 내용을 내려받거나 사본으로 저장하지 않습니다.</p><p>전용 창에 파일을 끌어놓으면 원본 확인 창 없이 연결합니다. 파일 연결 창에서 파일을 선택하거나 ‘파일 선택이 열리지 않나요?’의 경로 붙여넣기를 사용할 수 있습니다. 폴더를 미리 지정할 필요가 없습니다. 일반 브라우저에서는 드래그한 파일의 전체 경로를 받을 수 없습니다. 원본을 이동하거나 삭제하면 다시 연결해 주세요.</p><p>코션.html만 직접 열면 브라우저 미리보기 모드이며 PC 기본 프로그램 실행은 지원하지 않습니다. 지원 브라우저에서는 원본 핸들을, 그 외에는 등록 시점의 사본을 보관한다고 표시합니다.</p><h3>미리보기</h3><p>마우스를 올리거나 카드의 눈 버튼을 누르세요. PDF는 실제 첫 페이지를 이미지로 표시합니다. HWP/HWPX는 저장된 미리보기를, Word·Excel·PowerPoint는 저장된 이미지 또는 설치된 Office를 사용합니다. 미리보기가 지원되지 않으면 이유를 표시하고 텍스트·표로 전환합니다.</p><h3>페이지와 저장</h3><p>페이지 크기는 고정하고 가로폭에 맞춰 표시합니다. 긴 보드는 세로로 스크롤합니다. 작은 페이지 이름은 위쪽 경로에서 수정하고 아래 숫자 버튼으로 페이지를 이동하세요.</p><p>작업은 현재 창의 저장 공간에 자동 저장됩니다. 기존 Chrome·Edge와 새 전용 창, HTML 직접 실행은 저장 공간이 다릅니다. 백업·복원으로 옮기고 주기적으로 보관하세요. 사이트 데이터를 지우면 작업이 사라집니다. 클라우드 동기화는 제공하지 않습니다.</p></div>`,
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
function hasDeletionUndo() {return undoStack.some(item=>item.pageId===page().id&&item.entries.some(({block})=>!page().blocks.some(b=>b.id===block.id)));}
function historyButtons() {return `<div class="history-tools"><button data-history="undo" title="실행 취소 (Ctrl+Z)" aria-label="실행 취소" ${editHistory.past.length?'':'disabled'}>${icon('undo-2')}</button><button data-history="redo" title="다시 실행 (Ctrl+Y)" aria-label="다시 실행" ${editHistory.future.length?'':'disabled'}>${icon('redo-2')}</button></div>`;}
function bindHistoryButtons() {document.querySelectorAll('[data-history]').forEach(button=>button.onclick=()=>restoreHistory(button.dataset.history));syncHistoryButtons();refreshIcons();}
function syncHistoryButtons() {document.querySelectorAll('[data-history]').forEach(button=>button.disabled=button.dataset.history==='undo'?!editHistory.past.length:!editHistory.future.length);}
function restoreHistory(direction) {
 const snapshot=editHistory[direction]();if(!snapshot)return;
 const ids=[...selectedIds],previousIds=new Set(state.pages.flatMap(p=>p.blocks.map(b=>b.id)));
 state=snapshot;active=state.pages.some(p=>p.id===state.active)?state.active:state.pages[0].id;state.active=active;
 selectedIds=new Set(ids.filter(id=>page().blocks.some(b=>b.id===id)));
 if(!selectedIds.size){const added=page().blocks.filter(b=>!previousIds.has(b.id)),addedIds=new Set(added.map(b=>b.id));selectedIds=new Set(added.filter(b=>!addedIds.has(b.parentId)).map(b=>b.id));}
 selected=[...selectedIds].at(-1)||null;cancelGesture?.();render();persist({history:false});
}
async function saveNow() {
 const focused=document.activeElement;if(focused?.closest('.context-toolbar,.object-context-menu')&&focused.matches('input,select'))focused.blur();
 clearTimeout(saveTimer);editHistory.record(state);syncHistoryButtons();
 try{await write('state',state,'workspace');$('#save-status').textContent='모든 변경사항 저장됨';toast('저장했습니다.');}catch{toast('저장하지 못했습니다. 저장 공간을 확인해 주세요.');}
}
function editing(element) {return element instanceof Element&&!!element.closest('input,select,textarea,[contenteditable]');}
function captureCaret() {
 const selection=window.getSelection(),root=document.activeElement?.closest('[data-edit],[data-cell]');
 if(!root||!selection?.rangeCount)return null;
 const id=root.closest('.block')?.dataset.id,cell=root.dataset.cell;
 const offsets=editorSelection(root);return offsets?{id,cell,...offsets}:null;
}
function restoreCaret(caret) {
 if(!caret)return;
 const block=document.querySelector(`.block[data-id="${caret.id}"]`),root=caret.cell?block?.querySelector(`[data-cell="${caret.cell}"]`):block?.querySelector('[data-edit]');if(!root)return;
 setEditorSelection(root,caret.anchor,caret.focus);
}
function shortcutFormat(key) {
 const blocks=selectionBlocks().filter(b=>textTypes.includes(b.type));if(!blocks.length)return false;
 const caret=captureCaret();
 const property={b:'bold',i:'italic',u:'underline',x:'strike'}[key];
 if(property) {
  const sample=blocks[0],node=document.querySelector(`.block[data-id="${sample.id}"] [data-edit],.block[data-id="${sample.id}"] [data-cell],.block[data-id="${sample.id}"] strong`);
  const css=node?getComputedStyle(node):null;
  const active=sample.format?.[property]??(property==='bold'?Number(css?.fontWeight)>=600:property==='italic'?css?.fontStyle==='italic':css?.textDecorationLine.includes(property==='strike'?'line-through':'underline'));
  blocks.forEach(b=>b.format={...b.format,[property]:!active});
 } else {const align={l:'left',e:'center',r:'right'}[key];blocks.forEach(b=>b.format={...b.format,align});}
 renderBlocks();persist();restoreCaret(caret);return true;
}
function nudgeSelection(dx,dy) {
 const blocks=selectionBlocks().filter(b=>!b.parentId&&!b.locked);if(!blocks.length)return;
 const delta=groupDelta(blocks,page(),dx,dy,false);blocks.forEach(b=>{b.x+=delta.x;b.y+=delta.y;});renderBlocks();persist({mergeKey:'nudge:'+blocks.map(b=>b.id).join(',')});
}
function clipboardCopy(event,cut=false) {
 if(editing(document.activeElement)||!selectedIds.size||!event.clipboardData)return;
 const payload=makeClipboard(page(),[...selectedIds]);if(!payload.blocks.length)return;objectClipboard=payload;
 event.clipboardData.setData(clipboardType,JSON.stringify(payload));
 event.clipboardData.setData('text/plain',payload.blocks.filter(b=>!b.parentId).map(b=>b.text||b.caption||b.name||blockNames[b.type]).join('\n'));
 event.preventDefault();if(cut)deleteSelection();else toast(`${selectedIds.size}개 개체 복사됨`);
}
function clipboardPaste(event) {
 if(event.defaultPrevented||editing(document.activeElement)||$('.modal'))return;
 const raw=event.clipboardData?.getData(clipboardType);
 if(raw){event.preventDefault();try{const roots=pasteBlocks(page(),readClipboard(raw));selectedIds=new Set(roots.map(b=>b.id));selected=roots.at(-1)?.id||null;renderBlocks();persist();toast(`${roots.length}개 개체 붙여넣기`);}catch(error){toast(error.message);}return;}
 const text=event.clipboardData?.getData('text/plain');if(text){event.preventDefault();addBlock('text',{text});}
}
document.addEventListener('copy',event=>clipboardCopy(event));
document.addEventListener('cut',event=>clipboardCopy(event,true));
document.addEventListener('paste',clipboardPaste);
document.addEventListener('keydown',event=>{
 if(event.isComposing)return;
 if(event.key==='Escape'&&editingLinkedId&&!objectMenuPosition){event.preventDefault();editingLinkedId=null;renderBlocks();$('#canvas')?.focus();return;}
 if(event.key==='Escape'&&objectMenuPosition){event.preventDefault();closeObjectMenu();$('#canvas')?.focus({preventScroll:true});return;}
 if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){if($('.modal'))return;if(selected){event.preventDefault();const rect=document.querySelector(`.block[data-id="${selected}"]`).getBoundingClientRect();openObjectMenu(selected,rect.left+20,rect.top+20);}return;}
 const key=event.key.toLowerCase(),control=event.ctrlKey||event.metaKey,field=event.target instanceof Element&&event.target.closest('input:not([type=checkbox]):not([type=radio]),select,textarea');
 if(control&&key==='k'&&!field&&!$('.modal')){event.preventDefault();if(selectedIds.size===1)linkDialog({block:selectionBlocks()[0]});else linkDialog();return;}
 if(control&&key==='s'){event.preventDefault();saveNow();return;}
 if($('.modal')){if(event.key==='Escape')closeModal();return;}
 if(control&&!event.shiftKey&&!field&&['b','i','u','l','e','r'].includes(key)&&shortcutFormat(key)){event.preventDefault();return;}
 if(control&&event.shiftKey&&key==='x'&&!field&&shortcutFormat('x')){event.preventDefault();return;}
 if(control&&!field&&(key==='z'||key==='y')){event.preventDefault();const caret=captureCaret();restoreHistory(key==='y'||event.shiftKey?'redo':'undo');restoreCaret(caret);return;}
 if(editing(event.target))return;
 if(control){
  if(key==='a'){event.preventDefault();selectedIds=new Set(page().blocks.filter(b=>!b.parentId).map(b=>b.id));selected=[...selectedIds].at(-1)||null;renderSelection();return;}
  if((key==='c'||key==='x')&&!event.shiftKey&&selectedIds.size){event.preventDefault();document.execCommand(key==='c'?'copy':'cut');return;}
  if(key==='d'&&selectedIds.size){event.preventDefault();document.querySelector('[data-block-action=duplicate]')?.click();return;}
  if(key==='n'){event.preventDefault();action('add-page');return;}
  if(key==='+'||key==='='){event.preventDefault();action('zoom-in');return;}
  if(key==='-'){event.preventDefault();action('zoom-out');return;}
  if(key==='0'){event.preventDefault();action('actual-size');return;}
  if(key==='o'){event.preventDefault();pickFiles();return;}
 }
 if(event.key==='Escape'){cancelGesture?.();hideHover();selectBlock(null);return;}
 if(event.key==='Delete'||event.key==='Backspace'){if(selectedIds.size){event.preventDefault();deleteSelection();}return;}
 const arrow={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
 if(arrow&&selectedIds.size){event.preventDefault();const factor=event.shiftKey?10:1;nudgeSelection(arrow[0]*factor,arrow[1]*factor);return;}
 if(event.key==='F2'||event.key==='Enter') {
  const b=selectionBlocks().find(b=>b.id===selected);if(!b)return;
  if(event.key==='F2'){event.preventDefault();editBlockContent(b);return;}
  if(event.key==='Enter'&&blockLink(b)){event.preventDefault();followBlockLink(b);return;}
  if(event.key==='Enter'&&b.type==='file'){event.preventDefault();openRegisteredFile(b.fileId);return;}
  if(event.key==='Enter'&&b.type==='drawer'){event.preventDefault();document.querySelector('[data-block-action=drawer-toggle]')?.click();return;}
  const root=document.querySelector(`.block[data-id="${b.id}"]`),target=root?.querySelector('[data-edit],input[data-drawer-name]')||document.querySelector('[data-prop=caption]');
  if(target){event.preventDefault();target.focus();}
 }
});
init().catch((e) => {
  $("#app").innerHTML =
    `<div class="startup-error"><h1>작업 공간을 열 수 없습니다</h1><p>브라우저의 사이트 데이터와 저장소 권한을 확인한 후 새로고침해 주세요.</p><p>${escape(e.message)}</p></div>`;
});

function closeObjectMenu() {
 objectMenuPosition=null;
 const menu=$('#object-context-menu');if(menu)menu.hidden=true;
}
function positionObjectMenu() {
 const menu=$('#object-context-menu');if(!menu||!objectMenuPosition)return;
 menu.hidden=false;
 const {x,y}=objectMenuPosition,rect=menu.getBoundingClientRect();
 menu.style.left=Math.max(8,Math.min(x,window.innerWidth-rect.width-8))+'px';
 menu.style.top=Math.max(8,Math.min(y,window.innerHeight-rect.height-8))+'px';
}
function openObjectMenu(id,x,y) {
 hideHover();closeObjectMenu();selectBlock(id,{preserve:true});
 objectMenuPosition={id:selected,x,y,scroll:menuScrollPosition()};positionObjectMenu();
 $('#object-context-menu')?.querySelector('select,input,button')?.focus({preventScroll:true});
}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.object-context-menu'))closeObjectMenu();},true);
window.addEventListener('resize',closeObjectMenu);
function menuScrollPosition(){const v=$('#viewport');return [v?.scrollLeft,v?.scrollTop,window.scrollX,window.scrollY].join(',');}
// Ignore queued scroll events from before the menu opened; close on actual board movement.
document.addEventListener('scroll',e=>{if(objectMenuPosition&&!e.target.closest?.('.object-context-menu')&&objectMenuPosition.scroll!==menuScrollPosition())closeObjectMenu();},true);

function tableDialog() {
 const p=page();
 modal('표 만들기',`<form id="table-form" class="table-form"><fieldset><legend>줄 / 칸</legend><label>줄 수<input name="rows" aria-label="줄 수" type="number" min="1" max="100" value="4" required/></label><label>칸 수<input name="columns" aria-label="칸 수" type="number" min="1" max="30" value="3" required/></label></fieldset><fieldset><legend>표 크기 (보드 기준 px)</legend><label>너비<input name="width" aria-label="표 너비" type="number" min="80" max="${p.width}" value="${Math.min(500,p.width)}" required/></label><label>높이<input name="height" aria-label="표 높이" type="number" min="60" max="${p.height}" value="220" required/></label></fieldset><label class="table-header-option"><input name="header" type="checkbox" checked/>첫 줄을 제목 줄로 표시</label><div class="table-insert-preview" aria-hidden="true"></div><p class="table-preview-caption"></p><p class="muted">줄은 가로 행, 칸은 세로 열입니다. 전체 셀은 최대 1,500개이며 표 안에서 줄과 칸을 추가할 수 있습니다.</p><p id="table-error" role="alert"></p><div class="form-footer"><button type="button" class="secondary-btn" data-table-cancel>취소</button><button type="submit" class="primary-btn">만들기</button></div></form>`);
 const form=$('#table-form');
 const preview=()=>{
  const rows=Number(form.elements.rows.value),columns=Number(form.elements.columns.value),r=Math.max(1,Math.min(8,rows||1)),c=Math.max(1,Math.min(8,columns||1));
  const grid=form.querySelector('.table-insert-preview');grid.style.gridTemplateColumns=`repeat(${c},1fr)`;
  grid.innerHTML=Array.from({length:r*c},(_,i)=>`<span class="${form.elements.header.checked&&i<c?'header-cell':''}"></span>`).join('');
  form.querySelector('.table-preview-caption').textContent=`${rows||0}줄 × ${columns||0}칸${rows>8||columns>8?' · 미리보기는 8줄·8칸까지 표시':''}`;
 };
 form.oninput=preview;preview();
 form.querySelector('[data-table-cancel]').onclick=closeModal;
 form.onsubmit=e=>{
  e.preventDefault();
  try {
   const cells=tableCells(Number(form.elements.rows.value),Number(form.elements.columns.value));
   const w=Number(form.elements.width.value),h=Number(form.elements.height.value);
   if(!Number.isFinite(w)||w<80||w>p.width||!Number.isFinite(h)||h<60||h>p.height)throw Error('표 크기를 보드 안의 범위로 입력해 주세요.');
   const tableHeader=form.elements.header.checked;closeModal();addBlock('table',{cells,w,h,tableHeader});
  }catch(error){$('#table-error').textContent=error.message;}
 };
 form.elements.rows.focus();form.elements.rows.select();
}
function editorBlock(root) {return page().blocks.find(b=>b.id===root.closest('.block')?.dataset.id);}
function blockText(b,cell) {if(!cell)return String(b.text||'');const [r,c]=cell.split(',').map(Number);return String(b.cells?.[r]?.[c]||'');}
function storeEditor(b,cell,text,checks) {
 if(cell){const [r,c]=cell.split(',').map(Number);b.cells ||= [['할 일','상태','비고'],['자료 정리','진행 중',''],['아이디어 모으기','예정',''],['함께 검토하기','예정','']];b.cells[r][c]=text;}
 else b.text=text;
 setChecks(b,cell,checks);
}
function syncTextEditor(root,composing=false) {
 const b=editorBlock(root);if(!b)return;
 const cell=root.dataset.cell,text=editorText(root),old=blockText(b,cell),checks=reconcileLines(old,text,checksFor(b,cell));
 const caret=editorSelection(root);storeEditor(b,cell,text,checks);
 if(!composing){root.innerHTML=lineMarkup(text,checks,escape);if(caret)setEditorSelection(root,caret.anchor,caret.focus);}
 persist({mergeKey:'typing:'+b.id});
}
function replaceEditorSelection(root,inserted,start,end) {
 const b=editorBlock(root);if(!b)return;
 const caret=editorSelection(root);if(start===undefined){if(!caret)return;start=Math.min(caret.anchor,caret.focus);end=Math.max(caret.anchor,caret.focus);}
 const cell=root.dataset.cell,result=replaceLines(blockText(b,cell),checksFor(b,cell),start,end,inserted);
 storeEditor(b,cell,result.text,result.checks);root.innerHTML=lineMarkup(result.text,result.checks,escape);setEditorSelection(root,start+inserted.length);
 persist({mergeKey:'typing:'+b.id});
}
function editBeforeInput(e) {
 const root=e.target.closest('[data-edit],[data-cell]');if(!root||e.isComposing||e.inputType==='insertCompositionText')return;
 const caret=editorSelection(root);if(!caret)return;
 let start=Math.min(caret.anchor,caret.focus),end=Math.max(caret.anchor,caret.focus),inserted='';
 const b=editorBlock(root),text=blockText(b,root.dataset.cell),type=e.inputType;
 if(type==='insertText'||type==='insertReplacementText') {if(e.data===null)return;inserted=e.data;}
 else if(type==='insertParagraph'||type==='insertLineBreak'){
  const line=text.slice(0,start).split('\n').length-1,checks=[...checksFor(b,root.dataset.cell)];
  if(start===end&&!text.split('\n')[line]&&typeof checks[line]==='boolean') {
   e.preventDefault();checks[line]=null;setChecks(b,root.dataset.cell,checks);root.innerHTML=lineMarkup(text,checks,escape);setEditorSelection(root,start);persist();return;
  }
  inserted='\n';
 } else if(['deleteContentBackward','deleteContentForward','deleteWordBackward','deleteWordForward','deleteByCut'].includes(type)) {
  if(start===end){
   if(type==='deleteContentBackward')start=Math.max(0,start-([...text.slice(0,start)].at(-1)?.length||0));
   if(type==='deleteContentForward')end=Math.min(text.length,end+([...text.slice(end)][0]?.length||0));
   if(type==='deleteWordBackward')start-=text.slice(0,start).match(/(?:\s*\S+|\s+)$/u)?.[0].length||0;
   if(type==='deleteWordForward')end+=text.slice(end).match(/^(?:\s*\S+|\s+)/u)?.[0].length||0;
  }
 } else return;
 e.preventDefault();replaceEditorSelection(root,inserted,start,end);
}
function toggleCurrentLine() {
 const root=document.activeElement?.closest('[data-edit],[data-cell]');
 if(!root||root.closest('.block')?.dataset.id!==selected||selectedIds.size!==1){toast('텍스트·메모·도형·표에서 체크할 줄에 커서를 놓아 주세요.');return;}
 const b=editorBlock(root),caret=editorSelection(root);if(!caret)return;
 const cell=root.dataset.cell,text=blockText(b,cell),line=text.slice(0,caret.focus).split('\n').length-1,checks=[...checksFor(b,cell)];
 checks[line]=typeof checks[line]==='boolean'?null:false;setChecks(b,cell,checks);
 root.innerHTML=lineMarkup(text,checks,escape);setEditorSelection(root,caret.anchor,caret.focus);persist();
}

function followBlockLink(block) {
 const link=blockLink(block);if(!link){toast('유효한 링크가 없습니다. 우클릭 메뉴에서 다시 설정해 주세요.');return;}
 if(link.kind==='page'){
  if(!state.pages.some(p=>p.id===link.pageId)){toast('연결된 페이지가 삭제되었습니다. 링크를 다시 설정해 주세요.');return;}
  editingLinkedId=null;switchPage(link.pageId);
 }else window.open(link.url,'_blank','noopener,noreferrer');
}
function editBlockContent(block) {
 editingLinkedId=block.hyperlink?block.id:null;renderBlocks();
 const root=document.querySelector(`.block[data-id="${block.id}"]`),target=root?.querySelector('[data-edit],[data-cell],input[data-drawer-name]')||document.querySelector('[data-prop=caption]');
 if(target){target.focus({preventScroll:true});if(block.hyperlink)toast('내용 편집 중 · Esc로 끝내기');}
 else toast('위쪽 설정 줄에서 개체 설정을 변경하세요.');
}
function drawerWheel(event) {
 if(event.ctrlKey)return;
 const drawer=event.target.closest('.block-drawer'),list=drawer?.querySelector(':scope > .drawer-list');
 if(!list||list.scrollHeight<=list.clientHeight+1)return;
 const delta=(event.deltaY||event.deltaX)*(event.deltaMode===1?16:event.deltaMode===2?list.clientHeight:1);
 if(!delta)return;event.preventDefault();event.stopPropagation();list.scrollTop+=delta;
}
function copySelectedObjects(cut=false) {
 const payload=makeClipboard(page(),[...selectedIds]);if(!payload.blocks.length)return;
 objectClipboard=payload;closeObjectMenu();window.getSelection()?.removeAllRanges();$('#canvas').focus({preventScroll:true});
 document.execCommand('copy');
 if(cut)deleteSelection();else toast(`${payload.blocks.length}개 개체 복사됨`);
}
function pasteObjectClipboard() {
 if(!objectClipboard)return;
 try{const roots=pasteBlocks(page(),readClipboard(JSON.stringify(objectClipboard)));selectedIds=new Set(roots.map(b=>b.id));selected=roots.at(-1)?.id||null;closeObjectMenu();renderBlocks();persist();toast(`${roots.length}개 개체 붙여넣기`);}catch(error){toast(error.message);}
}
function fileConnectDialog() {
 closeObjectMenu();
 modal('파일 연결',`<div class="insert-form file-connect-options"><p>탐색기에서 파일을 골라 원본 위치를 연결하세요. 전용 창에서는 파일을 보드에 끌어놓아도 됩니다.</p><button class="primary-btn" id="choose-original">${icon('folder-open')}파일 선택</button><details><summary>파일 선택이 열리지 않나요?</summary><p>선택 창이 열리지 않을 때 원본 파일의 전체 경로를 직접 붙여넣어 연결할 수 있습니다.</p><button class="secondary-btn" id="connect-by-path">경로 붙여넣기</button></details></div>`);
 $('#choose-original').onclick=()=>{closeModal();chooseOriginalFiles();};
 $('#connect-by-path').onclick=()=>action('path-shortcut');
}

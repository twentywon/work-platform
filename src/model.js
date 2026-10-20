import {isShape} from './shapes.js';
export const uid = () => globalThis.crypto.randomUUID();
export function makePage(index, width = 1160, height = 760) {
  return { id: uid(), title: `새 페이지 ${index}`, width, height, blocks: [] };
}
export function makeBlock(type, x = 60, y = 210, extra = {}) {
  const sizes = {
    drawer: [380, 60],
    note: [290, 190],
    text: [350, 100],
    table: [490, 220],
    rect: [200, 200],
    circle: [160, 160],
    hline: [450, 16],
    vline: [16, 280],
    file: [290, 86],
    checkbox: [300, 60],
    media: [400, 280],
    web: [320, 100],
    pagelink: [300, 80],
    calendar: [440, 420],
  };
  const [w, h] = sizes[type] || (isShape(type)?[200,200]:[290, 190]);
  return {
    id: uid(),
    type,
    x,
    y,
    w,
    h,
    text:
      type === "checkbox" ? "할 일을 입력하세요." : type === "note"
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

// Drawer members stay in the page's flat record list so file IDs and editing stay stable.
export function drawerChildren(page, id) { return page.blocks.filter(b=>b.parentId===id); }
export function putInDrawer(page, ids, drawerId) {
  const drawer=page.blocks.find(b=>b.id===drawerId&&b.type==='drawer');
  if(!drawer) throw Error('서랍을 찾을 수 없습니다.');
  for(const id of ids) {
    const block=page.blocks.find(b=>b.id===id);
    if(!block||block.type==='drawer') continue;
    block.parentId=drawerId;
  }
  drawer.expanded=true;
  drawer.h=Math.min(page.height,Math.max(260,drawer.openHeight||360));
  clampBlock(drawer,page);
}
export function takeOutOfDrawer(page,id) {
  const block=page.blocks.find(b=>b.id===id);
  if(!block?.parentId)return;
  const drawer=page.blocks.find(b=>b.id===block.parentId);
  delete block.parentId;
  const right=(drawer?.x||0)+(drawer?.w||0)+20;
  const beside=right+block.w<=page.width;
  block.x=beside?right:(drawer?.x||0);
  block.y=beside?(drawer?.y||0):(drawer?.y||0)+(drawer?.h||0)+20;
  clampBlock(block,page);
}
export function deleteBlocks(page,ids) {
  const removed=new Set(ids);
  let changed=true;
  while(changed) {changed=false;for(const b of page.blocks)if(removed.has(b.parentId)&&!removed.has(b.id)){removed.add(b.id);changed=true;}}
  const entries=page.blocks.flatMap((block,index)=>removed.has(block.id)?[{block:structuredClone(block),index}]:[]);
  page.blocks=page.blocks.filter(b=>!removed.has(b.id));
  return entries;
}
export function deleteBlock(page,id) { return deleteBlocks(page,[id]); }
export function rotatedBounds(b) {
 const angle=(b.rotation||0)*Math.PI/180;
 const w=Math.abs(b.w*Math.cos(angle))+Math.abs(b.h*Math.sin(angle));
 const h=Math.abs(b.w*Math.sin(angle))+Math.abs(b.h*Math.cos(angle));
 return {left:b.x+(b.w-w)/2,top:b.y+(b.h-h)/2,right:b.x+(b.w+w)/2,bottom:b.y+(b.h+h)/2};
}
export function groupDelta(blocks,page,dx,dy,snapToGrid=true) {
 const bounds=blocks.map(rotatedBounds);
 return {
  x:Math.max(-Math.min(...bounds.map(r=>r.left)),Math.min(snapToGrid?snap(dx):dx,page.width-Math.max(...bounds.map(r=>r.right)))),
  y:Math.max(-Math.min(...bounds.map(r=>r.top)),Math.min(snapToGrid?snap(dy):dy,page.height-Math.max(...bounds.map(r=>r.bottom)))),
 };
}
export function duplicateBlock(page,id) {
  const block=page.blocks.find(b=>b.id===id);
  if(!block)return null;
  const copy=clampBlock({...structuredClone(block),id:uid(),x:snap(block.x+40),y:snap(block.y+40)},page);
  page.blocks.push(copy);
  if(block.type==='drawer') for(const child of drawerChildren(page,id))page.blocks.push({...structuredClone(child),id:uid(),parentId:copy.id});
  return copy;
}

// Rotation changes only the angle. The layout anchor, center and size remain fixed.
export function rotateBlock(block,angle) {block.rotation=Number.isFinite(Number(angle))?Number(angle)%360:0;return block;}

// Move selected siblings together without changing their relative order or drawer membership.
export function reorderBlocks(page, ids, direction) {
 const selected=new Set(ids),roots=page.blocks.filter(b=>selected.has(b.id)&&!selected.has(b.parentId));
 for(const parent of new Set(roots.map(b=>b.parentId||null))) {
  const indexes=page.blocks.flatMap((b,i)=>(b.parentId||null)===parent?[i]:[]);
  let siblings=indexes.map(i=>page.blocks[i]);
  const included=new Set(roots.filter(b=>(b.parentId||null)===parent).map(b=>b.id));
  if(direction==='front'||direction==='back'){
   const chosen=siblings.filter(b=>included.has(b.id)),rest=siblings.filter(b=>!included.has(b.id));
   siblings=direction==='front'?[...rest,...chosen]:[...chosen,...rest];
  }else if(direction==='forward'){
   for(let i=siblings.length-2;i>=0;i--)if(included.has(siblings[i].id)&&!included.has(siblings[i+1].id))[siblings[i],siblings[i+1]]=[siblings[i+1],siblings[i]];
  }else if(direction==='backward'){
   for(let i=1;i<siblings.length;i++)if(included.has(siblings[i].id)&&!included.has(siblings[i-1].id))[siblings[i-1],siblings[i]]=[siblings[i],siblings[i-1]];
  }
  indexes.forEach((index,i)=>page.blocks[index]=siblings[i]);
 }
}

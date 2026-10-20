import {readBackup} from './backup.js';
import {uid} from './model.js';
export const clipboardType='application/x-cotion-blocks';
export function makeClipboard(page,ids) {
 const selected=new Set(ids);let changed=true;
 while(changed){changed=false;for(const b of page.blocks)if(selected.has(b.parentId)&&!selected.has(b.id)){selected.add(b.id);changed=true;}}
 const blocks=structuredClone(page.blocks.filter(b=>selected.has(b.id)));
 for(const b of blocks)if(!selected.has(b.parentId))delete b.parentId;
 return {format:'cotion-blocks',version:1,width:page.width,height:page.height,blocks};
}
export function readClipboard(raw) {
 const payload=JSON.parse(raw);
 if(payload.format!=='cotion-blocks'||payload.version!==1||!Array.isArray(payload.blocks)||!payload.blocks.length||payload.blocks.length>1000)throw Error('코션 개체 복사 내용이 올바르지 않습니다.');
 const page={id:'clipboard-page',title:'복사',width:payload.width,height:payload.height,blocks:payload.blocks};
 return readBackup({format:'moa-workspace',version:1,state:{pages:[page],active:page.id},files:[]}).state.pages[0].blocks;
}
export function pasteBlocks(page,source,dx=20,dy=20) {
 const map=new Map(source.map(b=>[b.id,uid()]));
 const clones=source.map(b=>({...structuredClone(b),id:map.get(b.id)}));
 const roots=clones.filter(b=>!map.has(b.parentId));
 const minX=Math.min(...roots.map(b=>b.x)),minY=Math.min(...roots.map(b=>b.y));
 const maxX=Math.max(...roots.map(b=>b.x+b.w)),maxY=Math.max(...roots.map(b=>b.y+b.h));
 const x=Math.max(-minX,Math.min(dx,page.width-maxX)),y=Math.max(-minY,Math.min(dy,page.height-maxY));
 for(const b of clones){if(map.has(b.parentId))b.parentId=map.get(b.parentId);else{delete b.parentId;b.x+=x;b.y+=y;}}
 page.blocks.push(...clones);
 return roots;
}

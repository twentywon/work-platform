import {checkedLink} from './links.js';
import {migrateCheckBlocks} from './line-editor.js';
import {blockNames} from './blocks.js';
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
export async function makeBackup(state,files) {
  const result=[];
  for(const record of files) {
    const {file,handle,...metadata}=record;
    if(handle&&!file)metadata.mode='unavailable';
    if(file){
      const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
      for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
      metadata.blob={data:btoa(binary),type:file.type,lastModified:file.lastModified};
    }
    result.push(metadata);
  }
  return {format:'moa-workspace',version:1,state:structuredClone(state),files:result};
}
export function readBackup(data) {
  if(data?.format!=='moa-workspace'||data.version!==1||!Array.isArray(data.state?.pages)||!data.state.pages.length||!Array.isArray(data.files))throw Error('코션 작업 백업 파일이 아닙니다.');
  const state=structuredClone(data.state),seen=new Set();
  for(const page of state.pages) {
    if(!id(page.id)||seen.has(page.id)||!Array.isArray(page.blocks)||!Number.isFinite(page.width)||!Number.isFinite(page.height)||page.width<600||page.width>7680||page.height<400||page.height>4320)throw Error('페이지 데이터가 올바르지 않습니다.');
    seen.add(page.id);
    for(const b of page.blocks){
      if(!id(b.id)||seen.has(b.id)||!Object.hasOwn(blockNames,b.type)||!['x','y','w','h'].every(k=>Number.isFinite(b[k]))||b.w<=0||b.h<=0||!/^#[a-f\d]{3,8}$/i.test(b.color)||b.role&&!/^[a-z -]{0,80}$/i.test(b.role))throw Error('개체 데이터가 올바르지 않습니다.');
      if(b.fileId&&!id(b.fileId)||b.targetPage&&!id(b.targetPage)||b.parentId&&!id(b.parentId))throw Error('연결 정보가 올바르지 않습니다.');
      if(b.month&&!/^(19|20|21|22)\d{2}-(0[1-9]|1[0-2])$/.test(b.month))throw Error('달력 데이터가 올바르지 않습니다.');
      if(b.hyperlink)b.hyperlink=checkedLink(b.hyperlink);
      seen.add(b.id);
    }
    for(const b of page.blocks)if(b.parentId&&(b.type==='drawer'||!page.blocks.some(p=>p.id===b.parentId&&p.type==='drawer')))throw Error('서랍 연결이 올바르지 않습니다.');
  }
  if(!state.pages.some(p=>p.id===state.active))state.active=state.pages[0].id;
  const files=data.files.map(record=>{
    if(!id(record.id)||record.desktopId&&!id(record.desktopId))throw Error('파일 기록이 올바르지 않습니다.');
    const {blob,...metadata}=record;
    if(blob){const binary=atob(blob.data);metadata.file=new File([Uint8Array.from(binary,c=>c.charCodeAt(0))],metadata.name,{type:blob.type,lastModified:blob.lastModified});}
    return metadata;
  });
  return {state:migrateCheckBlocks(state),files};
}

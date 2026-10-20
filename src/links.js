import {webURL} from './blocks.js';
export function checkedLink(value) {
 if(value?.kind==='web')return {kind:'web',url:webURL(value.url)};
 if(value?.kind==='page'&&typeof value.pageId==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value.pageId))return {kind:'page',pageId:value.pageId};
 throw Error('인터넷 주소 또는 연결할 페이지를 선택해 주세요.');
}
export function blockLink(block) {
 try {
  if(block.hyperlink)return checkedLink(block.hyperlink);
  if(block.type==='web')return checkedLink({kind:'web',url:block.url});
  if(block.type==='pagelink')return checkedLink({kind:'page',pageId:block.targetPage});
 }catch{}
 return null;
}
export function setBlockLink(block, link) {
 const checked=checkedLink(link);
 if(['web','pagelink'].includes(block.type)){
  block.type=checked.kind==='web'?'web':'pagelink';delete block.url;delete block.targetPage;
  if(checked.kind==='web')block.url=checked.url;else block.targetPage=checked.pageId;
  delete block.hyperlink;
 }else block.hyperlink=checked;
}
export function removeBlockLink(block) {
 delete block.hyperlink;
 if(['web','pagelink'].includes(block.type)){
  const text=block.text||block.url||'링크';block.type='text';block.text=text;delete block.url;delete block.targetPage;
 }
}

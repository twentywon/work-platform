// Checklist state follows logical paragraphs (Enter), independent of visual wrapping.
export function checksFor(block, cell) { return (cell ? block.cellChecks?.[cell] : block.lineChecks) || []; }
export function setChecks(block, cell, checks) {
 if(cell){block.cellChecks ||= {};block.cellChecks[cell]=checks;}
 else block.lineChecks=checks;
}
export function migrateCheckBlocks(state) {
 for(const page of state.pages)for(const b of page.blocks)if(b.type==='checkbox'){
  b.type='text';b.lineChecks=String(b.text||'').split('\n').map(()=>!!b.checked);delete b.checked;
 }
 return state;
}
export function replaceLines(text, checks, start, end, inserted) {
 start=Math.max(0,Math.min(text.length,start));end=Math.max(start,Math.min(text.length,end));
 const first=text.slice(0,start).split('\n').length-1,last=text.slice(0,end).split('\n').length-1;
 const extra=inserted.split('\n').length-1;
 const before=Array.from({length:first},(_,i)=>typeof checks[i]==='boolean'?checks[i]:null);
 const current=typeof checks[first]==='boolean'?checks[first]:null;
 const after=text.slice(end).split('\n').slice(1).map((_,i)=>typeof checks[last+1+i]==='boolean'?checks[last+1+i]:null);
 const middle=[current,...Array(extra).fill(current===null?null:false)];
 // A suffix beginning at an untouched paragraph boundary keeps its own state.
 const startsAtBoundary=start===0||text[start-1]==='\n',endsAtBoundary=end===0||text[end-1]==='\n';
 if(endsAtBoundary&&(inserted.endsWith('\n')||(!inserted&&startsAtBoundary))) {
  middle[middle.length-1]=typeof checks[last]==='boolean'?checks[last]:null;
  if(extra&&start===end&&startsAtBoundary)middle[0]=current===null?null:false;
 }
 return {text:text.slice(0,start)+inserted+text.slice(end),checks:[...before,...middle,...after]};
}
export function reconcileLines(oldText, newText, checks) {
 let start=0;while(start<oldText.length&&start<newText.length&&oldText[start]===newText[start])start++;
 let tail=0;while(tail<oldText.length-start&&tail<newText.length-start&&oldText.at(-tail-1)===newText.at(-tail-1))tail++;
 return replaceLines(oldText,checks,start,oldText.length-tail,newText.slice(start,newText.length-tail)).checks;
}
export function lineMarkup(text, checks, escape) {
 return String(text??'').split('\n').map((line,i)=>{
  const check=typeof checks[i]==='boolean';
  return `<div class="text-line ${check?'has-line-check':''} ${checks[i]===true?'line-done':''}" data-text-line="${i}">${check?`<span class="line-checkbox" contenteditable="false"><input type="checkbox" data-line-check="${i}" aria-label="${i+1}번째 줄 완료" ${checks[i]?'checked':''}/></span>`:''}<span data-line-content>${escape(line)||'<br>'}</span></div>`;
 }).join('');
}
export function editorText(root) {
 const rows=[...root.children];
 if(rows.length&&rows.every(row=>row.hasAttribute('data-text-line')))
  return rows.map(row=>row.querySelector('[data-line-content]')?.textContent||'').join('\n');
 return root.innerText.replace(/\r/g,'');
}
export function editorSelection(root) {
 const s=window.getSelection();if(!s?.rangeCount||!root.contains(s.anchorNode)||!root.contains(s.focusNode))return null;
 const offset=(node,index)=>{
  const rows=[...root.children].filter(el=>el.hasAttribute('data-text-line'));
  if(node===root&&rows.length)return Math.min(editorText(root).length,rows.slice(0,index).reduce((n,row)=>n+(row.querySelector('[data-line-content]')?.textContent.length||0)+1,0));
  const row=(node.nodeType===Node.ELEMENT_NODE?node:node.parentElement)?.closest('[data-text-line]');
  const range=document.createRange();range.selectNodeContents(row||root);range.setEnd(node,index);
  const preceding=row?rows.slice(0,rows.indexOf(row)).reduce((n,r)=>n+(r.querySelector('[data-line-content]')?.textContent.length||0)+1,0):0;
  return preceding+range.toString().length;
 };
 return {anchor:offset(s.anchorNode,s.anchorOffset),focus:offset(s.focusNode,s.focusOffset)};
}
export function setEditorSelection(root, anchor, focus=anchor) {
 root.focus({preventScroll:true});
 const point=offset=>{
  const rows=[...root.children].filter(el=>el.hasAttribute('data-text-line'));
  let target=root;
  if(rows.length){
   for(let i=0;i<rows.length;i++){
    target=rows[i].querySelector('[data-line-content]');
    const length=target.textContent.length;
    if(offset<=length||i===rows.length-1){offset=Math.min(offset,length);break;}
    offset-=length+1;
   }
  }
  const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);let node;
  while(node=walker.nextNode()){if(offset<=node.length)return [node,offset];offset-=node.length;}
  return [target,target.childNodes.length];
 };
 const a=point(Math.max(0,anchor)),f=point(Math.max(0,focus));window.getSelection().setBaseAndExtent(a[0],a[1],f[0],f[1]);
}

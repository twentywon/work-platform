import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EditHistory} from '../src/history.js';
import {makePage,makeBlock,rotateBlock} from '../src/model.js';
import {makeClipboard,readClipboard,pasteBlocks} from '../src/clipboard.js';
test('history coalesces typing, ignores navigation, redoes and drops an abandoned future',()=>{
 const p=makePage(1),q=makePage(2),state={pages:[p,q],active:p.id},history=new EditHistory();history.reset(state);
 state.active=q.id;history.record(state);assert.equal(history.past.length,0);
 q.title='a';history.record(state,'title',100);q.title='ab';history.record(state,'title',200);assert.equal(history.past.length,1);
 assert.equal(history.undo().pages[1].title,'새 페이지 2');assert.equal(history.redo().pages[1].title,'ab');
 history.undo();const next=structuredClone(history.current);next.pages[1].title='different';history.record(next);assert.equal(history.future.length,0);
});
test('clipboard clones drawer structure without copying or changing original file identities',()=>{
 const p=makePage(1);p.blocks=[makeBlock('drawer',60,60,{id:'drawer'}),makeBlock('file',0,0,{id:'file',parentId:'drawer',fileId:'original-file'}),makeBlock('text',600,60,{id:'unselected'})];
 const payload=makeClipboard(p,['drawer','file']);const source=readClipboard(JSON.stringify(payload)),clones=pasteBlocks(p,source);
 assert.equal(clones.length,1);assert.notEqual(clones[0].id,'drawer');
 const child=p.blocks.find(b=>b.parentId===clones[0].id);assert.notEqual(child.id,'file');assert.equal(child.fileId,'original-file');assert.equal(p.blocks.filter(b=>b.id==='unselected').length,1);
 const childOnly=makeClipboard(p,['file']);assert.equal(childOnly.blocks[0].parentId,undefined);
});
test('rotation at page edges and through a full turn preserves absolute anchor and dimensions',()=>{
 const b=makeBlock('rect',0,0,{w:700,h:100});const geometry=({x,y,w,h})=>({x,y,w,h}),before=geometry(b);
 for(const angle of [45,90,120,180,270,360,720,-45]){rotateBlock(b,angle);assert.deepEqual(geometry(b),before);}
});

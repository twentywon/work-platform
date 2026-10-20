import test from 'node:test';import assert from 'node:assert/strict';import {reorderBlocks} from '../src/model.js';
test('layer steps preserve selected order and drawer membership across interleaved records',()=>{
 const page={blocks:[{id:'a'},{id:'d',type:'drawer'},{id:'child',parentId:'d',fileId:'original'},{id:'b'},{id:'c'}]};
 reorderBlocks(page,['a','b'],'forward');assert.deepEqual(page.blocks.filter(b=>!b.parentId).map(b=>b.id),['d','a','c','b']);assert.equal(page.blocks.find(b=>b.id==='child').fileId,'original');assert.equal(page.blocks.find(b=>b.id==='child').parentId,'d');
 reorderBlocks(page,['a','b'],'backward');assert.deepEqual(page.blocks.filter(b=>!b.parentId).map(b=>b.id),['a','d','b','c']);
 reorderBlocks(page,['d','child'],'front');assert.deepEqual(page.blocks.filter(b=>!b.parentId).map(b=>b.id),['a','b','c','d']);assert.equal(page.blocks.find(b=>b.id==='child').parentId,'d');
});
test('drawer sibling reordering never moves another drawer member or rewrites file IDs',()=>{
 const page={blocks:[{id:'d'},{id:'x',parentId:'d',fileId:'original'},{id:'other',parentId:'other-drawer'},{id:'y',parentId:'d'},{id:'z',parentId:'d'}]};
 reorderBlocks(page,['x'],'forward');assert.deepEqual(page.blocks.filter(b=>b.parentId==='d').map(b=>b.id),['y','x','z']);assert.equal(page.blocks[2].id,'other');assert.equal(page.blocks.find(b=>b.id==='x').fileId,'original');
});

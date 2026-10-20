import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceLines,reconcileLines,migrateCheckBlocks} from '../src/line-editor.js';
import {tableCells} from '../src/table.js';
test('paragraph checks survive splitting, merging, multi-line replacement and IME reconciliation',()=>{
 const split=replaceLines('first\nsecond\nthird',[null,true,false],10,10,'\n');
 assert.equal(split.text,'first\nseco\nnd\nthird');assert.deepEqual(split.checks,[null,true,false,false]);
 const merge=replaceLines(split.text,split.checks,10,11,'');assert.equal(merge.text,'first\nsecond\nthird');assert.deepEqual(merge.checks,[null,true,false]);
 const inserted=replaceLines('first\nsecond\nthird',[false,true,null],0,6,'a\nb\n');assert.deepEqual(inserted.checks,[false,false,true,null]);
 assert.deepEqual(reconcileLines('업무\n진행','새 업무\n진행',[false,true]),[false,true]);
});
test('legacy standalone checkboxes migrate idempotently without changing identities or original files',()=>{
 const state={pages:[{blocks:[{id:'task',type:'checkbox',text:'첫 줄\n둘째 줄',checked:true,parentId:'drawer'},{id:'file',type:'file',fileId:'original'}]}]};
 migrateCheckBlocks(state);assert.deepEqual(state.pages[0].blocks[0],{id:'task',type:'text',text:'첫 줄\n둘째 줄',parentId:'drawer',lineChecks:[true,true]});
 assert.equal(state.pages[0].blocks[1].fileId,'original');const copy=structuredClone(state);migrateCheckBlocks(state);assert.deepEqual(state,copy);
});
test('table dimensions reject fractional, excessive and invalid sizes and create independent cells',()=>{
 for(const args of [[0,3],[3,0],[1.5,2],[101,1],[2,31],[100,30],[NaN,2]])assert.throws(()=>tableCells(...args));
 const cells=tableCells(3,5);assert.equal(cells.length,3);assert.equal(cells[0].length,5);cells[0][0]='a';assert.equal(cells[1][0],'');
});

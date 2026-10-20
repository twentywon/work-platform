import { test } from "node:test";
import assert from "node:assert/strict";
import { makePage, makeBlock, clampBlock, fitScale, snap, rotatedDelta } from "../src/model.js";
test("fixed page dimensions survive viewport changes", () => {
  const p = makePage(1, 1920, 1080);
  assert.equal(fitScale(p, 960, 540), 0.5);
  assert.equal(p.width, 1920);
  assert.equal(p.height, 1080);
  assert.equal(fitScale(p, 3840, 2160), 2);
});
test("block movement and resizing stay within fixed page", () => {
  const p = makePage(1, 800, 600);
  const b = makeBlock("table", 790, -20, { w: 900, h: 200 });
  clampBlock(b, p);
  assert.deepEqual([b.x, b.y, b.w, b.h], [0, 0, 800, 200]);
  b.x = 700;
  b.y = 700;
  clampBlock(b, p);
  assert.equal(b.y, 400);
  assert.equal(b.x, 0);
});
test("new pages and blocks are independent", () => {
  const a = makePage(1),
    b = makePage(2);
  a.blocks.push(makeBlock("vline"));
  assert.notEqual(a.id, b.id);
  assert.equal(b.blocks.length, 0);
  assert.equal(a.blocks[0].w, 16);
});

test("width fitting ignores short viewport height; movement snaps to grid", () => {
  assert.equal(fitScale(makePage(1, 1000, 1800), 1500, 300), 1.5);
  assert.equal(snap(37), 40);
  assert.equal(snap(71), 80);
  const local = rotatedDelta(0, 60, 90);
  assert.ok(Math.abs(local.x - 60) < 0.001);
  assert.ok(Math.abs(local.y) < 0.001);
});
test("rotated objects remain entirely within the fixed board", () => {
  const p = makePage(1, 800, 600);
  const b = makeBlock("rect", -100, 580, { w: 300, h: 160, rotation: 45 });
  clampBlock(b, p);
  const half = (b.w + b.h) * Math.SQRT1_2 / 2;
  assert.ok(b.x + b.w / 2 - half > -0.001);
  assert.ok(b.y + b.h / 2 + half < p.height + 0.001);
});

test('drawer movement preserves file identity; deleting a drawer releases its contents', async () => {
  const {putInDrawer,deleteBlock,duplicateBlock,drawerChildren,takeOutOfDrawer}=await import('../src/model.js');
  const p=makePage(1);const d=makeBlock('drawer');const f=makeBlock('file',60,80,{fileId:'original-file'});p.blocks.push(d,f);
  putInDrawer(p,[f.id],d.id);assert.equal(f.parentId,d.id);assert.equal(f.fileId,'original-file');assert.equal(d.expanded,true);
  const copy=duplicateBlock(p,d.id);assert.equal(drawerChildren(p,copy.id).length,1);assert.equal(drawerChildren(p,copy.id)[0].fileId,'original-file');
  takeOutOfDrawer(p,f.id);assert.equal(f.parentId,undefined);
  putInDrawer(p,[f.id],d.id);deleteBlock(p,d.id);assert.ok(p.blocks.includes(f));assert.equal(f.parentId,undefined);
});

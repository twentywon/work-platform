import { test } from "node:test";
import assert from "node:assert/strict";
import { makePage, makeBlock, clampBlock, fitScale } from "../src/model.js";
test("fixed page dimensions survive viewport changes", () => {
  const p = makePage(1, 1920, 1080);
  assert.equal(fitScale(p, 960, 540), 0.5);
  assert.equal(p.width, 1920);
  assert.equal(p.height, 1080);
  assert.equal(fitScale(p, 3840, 2160), 1);
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webURL, mediaKind, monthDays, shiftMonth } from '../src/blocks.js';
test('web links allow only external http(s) addresses', () => {
  assert.equal(webURL('example.com/path?q=hi'), 'https://example.com/path?q=hi');
  assert.equal(webURL('https://example.com/'), 'https://example.com/');
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///C:/test', 'https://name:secret@example.com', '']) assert.throws(()=>webURL(url));
});
test('calendar handles leap days, week offsets and year boundaries', () => {
  const feb = monthDays('2024-02');
  assert.equal(feb[0], null);
  assert.equal(feb[4], '2024-02-01');
  assert.equal(feb.filter(Boolean).length,29);
  assert.equal(monthDays('2025-02').filter(Boolean).length,28);
  assert.equal(shiftMonth('2024-12',1),'2025-01');
  assert.equal(shiftMonth('2025-01',-1),'2024-12');
});
test('media selection recognizes GIF and supported videos', () => {
  assert.equal(mediaKind({name:'animation.GIF'}),'image');
  assert.equal(mediaKind({name:'movie.webm'}),'video');
  assert.equal(mediaKind({name:'script.html'}),null);
});

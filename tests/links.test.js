import test from 'node:test';import assert from 'node:assert/strict';
import {checkedLink,blockLink,setBlockLink,removeBlockLink} from '../src/links.js';
import {regularPoints,shapes} from '../src/shapes.js';import {makeBlock} from '../src/model.js';
import {makeClipboard,readClipboard,pasteBlocks} from '../src/clipboard.js';
import {readBackup} from '../src/backup.js';
test('regular polygons have equal edges and new shapes start in proportion',()=>{
 for(const n of [3,5,6]){const points=regularPoints(n).split(' ').map(p=>p.split(',').map(Number));const edges=points.map((p,i)=>Math.hypot(p[0]-points[(i+1)%n][0],p[1]-points[(i+1)%n][1]));assert.ok(Math.max(...edges)-Math.min(...edges)<1e-9);}
 for(const type of Object.keys(shapes)){const b=makeBlock(type);assert.equal(b.w,b.h);assert.equal(b.keepAspect,undefined);}
});
test('unified links preserve legacy cards, reject executable URLs and detach without losing content',()=>{
 assert.deepEqual(blockLink({type:'web',url:'example.com'}),{kind:'web',url:'https://example.com/'});
 const b={type:'note',id:'n',text:'메모'};setBlockLink(b,{kind:'page',pageId:'page-2'});assert.equal(b.type,'note');assert.equal(b.hyperlink.pageId,'page-2');removeBlockLink(b);assert.equal(b.text,'메모');assert.equal(b.hyperlink,undefined);
 const card={type:'pagelink',targetPage:'p',text:'이름'};setBlockLink(card,{kind:'web',url:'example.com'});assert.equal(card.type,'web');assert.equal(card.targetPage,undefined);removeBlockLink(card);assert.equal(card.type,'text');assert.equal(card.text,'이름');
 for(const url of ['javascript:alert(1)','file:///C:/Users/a','data:text/html,a','https://user:secret@example.com'])assert.throws(()=>checkedLink({kind:'web',url}));
});
test('object links survive validated backup and object clipboard with original file identities',()=>{
 const block=makeBlock('file',20,20,{id:'f',fileId:'original',name:'원본.hwp',hyperlink:{kind:'page',pageId:'p'}});
 const page={id:'p',title:'페이지',width:1160,height:760,blocks:[block]},state={pages:[page],active:'p'};
 const restored=readBackup({format:'moa-workspace',version:1,state,files:[]});assert.equal(restored.state.pages[0].blocks[0].hyperlink.pageId,'p');
 const source=readClipboard(JSON.stringify(makeClipboard(page,['f']))),copies=pasteBlocks(page,source);assert.equal(copies[0].fileId,'original');assert.deepEqual(copies[0].hyperlink,block.hyperlink);assert.notEqual(copies[0].id,'f');
 const malicious=structuredClone(state);malicious.pages[0].blocks[0].hyperlink={kind:'web',url:'javascript:alert(1)'};assert.throws(()=>readBackup({format:'moa-workspace',version:1,state:malicious,files:[]}));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {textStyle,appearanceStyle} from '../src/format.js';
test('untrusted backup formatting cannot insert CSS rules or URLs',()=>{
 const style=textStyle({font:'Arial; background:url(https://evil.example)',size:'20;position:fixed',color:'#fff;position:fixed',align:'left;position:fixed',lineHeight:Infinity});
 assert.equal(style,'');
 assert.equal(appearanceStyle({background:'url(https://evil.example)',borderColor:'red;position:fixed',opacity:'1;position:fixed',fit:'cover;position:fixed'}),'');
});

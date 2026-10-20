import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makePage,makeBlock} from '../src/model.js';
import {makeBackup,readBackup} from '../src/backup.js';
test('backup restores drawer structure and media bytes without copying native originals',async()=>{
 const p=makePage(1);p.blocks.push(makeBlock('drawer',60,80,{id:'drawer'}),makeBlock('media',60,80,{parentId:'drawer',fileId:'media'}));
 const native={id:'native',mode:'desktop',desktopId:'native-id',path:'C:\\Docs\\report.hwp',name:'report.hwp'};
 const media={id:'media',mode:'copy',name:'hello.gif',file:new File(['GIF89a'],'hello.gif')};
 const backup=await makeBackup({pages:[p],active:p.id},[native,media]);
 assert.equal(backup.files[0].blob,undefined);
 const restored=readBackup(JSON.parse(JSON.stringify(backup)));assert.equal(restored.state.pages[0].blocks[1].parentId,'drawer');
 assert.equal(await restored.files[1].file.text(),'GIF89a');
});
test('backup rejects injected object IDs before they can enter HTML attributes',()=>{
 const p=makePage(1);p.blocks.push(makeBlock('text',60,80,{id:'" onclick="alert(1)'}));
 assert.throws(()=>readBackup({format:'moa-workspace',version:1,state:{pages:[p],active:p.id},files:[]}));
});

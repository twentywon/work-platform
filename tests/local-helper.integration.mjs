import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp,mkdir,writeFile,readFile,cp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from '@playwright/test';
const root=await mkdtemp(path.join(os.tmpdir(),'moa-helper-'));
const profile=path.join(root,'data');await mkdir(profile);
const origin='http://127.0.0.1:17844';
const original=path.join(root,'원본 문서.txt');await writeFile(original,'원본 내용');
await writeFile(path.join(profile,'links.json'),JSON.stringify({entries:{'approved-file':original},roots:[]}));
for(const name of ['Moa-Local.ps1','Moa-Worker.ps1'])await cp('windows/'+name,path.join(root,name));
await cp('코션.html',path.join(root,'코션.html'));
const executable=process.env.MOA_POWERSHELL||(process.platform==='win32'?'powershell.exe':'pwsh');
let output='';
const child=spawn(executable,['-NoLogo','-NoProfile','-File',path.join(root,'Moa-Local.ps1'),'-NoBrowser','-Port','17844','-DataDirectory',profile],{env:process.env});
child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
let browser;
try {
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Startup timed out: '+output)),15000);
    const check=setInterval(()=>{
      if(output.includes(origin)){clearInterval(check);clearTimeout(timeout);resolve()}
      else if(child.exitCode!==null){clearInterval(check);clearTimeout(timeout);reject(Error(output))}
    },100);
    child.once('error',e=>{clearInterval(check);clearTimeout(timeout);reject(e)});
  });
  const html=await(await fetch(origin)).text();
  const token=html.match(/window\.moaLocal=\{token:"([a-f0-9]+)"/)[1];
  const request=(route,body={},headers={})=>fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Moa-Token':token,...headers},body:JSON.stringify(body)});
  assert.equal((await request('read',{id:'approved-file'},{'X-Moa-Token':'wrong'})).status,403);
  assert.equal((await request('read',{id:'approved-file'},{Origin:'https://evil.example'})).status,403);
  assert.equal((await request('open',{id:original})).status,400);
  assert.equal((await request('job',{id:'../../etc/passwd'})).status,400);
  assert.equal((await request('preview-start',{id:original})).status,400);
  assert.equal((await request('paths',{paths:['relative.txt']})).status,400);
  const status=await(await request('status')).json();
  assert.equal(status.version,'0.8.1');assert.equal(status.folderCount,0);
  const direct=await(await request('paths',{paths:['"'+original+'"']})).json();
  assert.equal(direct.files[0].id,'approved-file');assert.equal(direct.files[0].path,original);
  await writeFile(original,'수정된 원본의 최신 내용');
  assert.equal(await(await request('read',{id:'approved-file'})).text(),'수정된 원본의 최신 내용');
  // Exercise actual isolated process lifecycle without opening an interactive dialog in CI.
  if(process.platform!=='win32') {
    const job=await(await request('select-start')).json();assert.ok(job.id);
    assert.equal((await request('status')).status,200); // Main server remains responsive.
    let result;
    for(let i=0;i<50;i++){
      await new Promise(r=>setTimeout(r,100));
      const response=await request('job',{id:job.id});result=await response.json();
      if(!result.pending)break;
    }
    assert.match(result.error,/Windows/);
    assert.equal((await request('job-content',{id:job.id})).status,400);
    assert.equal((await request('job-cancel',{id:job.id})).status,200);
    assert.deepEqual((await(await request('job',{id:job.id})).json()).files,[]);
  }
  browser=await chromium.launch({executablePath:process.env.MOA_CHROMIUM||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:960}});page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Mock only WebView2's Windows File -> native-path boundary. All registration/read APIs are real.
  await page.addInitScript(({original})=>{
    const listeners=[];window.nativePathMessages=0;
    window.chrome ||= {};
    window.chrome.webview={
      addEventListener(type,fn){if(type==='message')listeners.push(fn)},
      postMessage(){},
      postMessageWithAdditionalObjects(message,files){
        if(!files.length||!files.every(file=>file instanceof File))throw Error('Expected actual File objects');
        window.nativePathMessages++;
        queueMicrotask(()=>listeners.forEach(fn=>fn({data:{id:message.id,paths:[original]}})));
      },
    };
  },{original});
  let pickerRequests=0;
  page.on('request',r=>{if(r.url().endsWith('/api/select-start'))pickerRequests++});
  await page.goto(origin);await page.locator('#canvas').waitFor();
  await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>[...document.fonts].some(f=>f.family.includes('Cotion Title Serif')&&f.status==='loaded')));
  assert.equal(await page.locator('[data-action=link-folder]').count(),0);
  await page.locator('#file-input').setInputFiles(original);
  const card=page.locator('.file-open').filter({hasText:'원본 문서.txt'});await card.waitFor();
  assert.match(await card.getAttribute('title'),/원본 문서/);
  await card.hover();await page.getByText('수정된 원본의 최신 내용',{exact:true}).waitFor();
  let opened;let downloads=0;page.on('download',()=>downloads++);
  await page.route('**/api/open',async route=>{opened=route.request().postDataJSON();await route.fulfill({json:{opened:true}})});
  await card.click();await page.waitForTimeout(100);assert.equal(opened.id,'approved-file');assert.equal(downloads,0);
  const record=await page.evaluate(async()=>{
    const db=await new Promise(resolve=>{const r=indexedDB.open('moa-workspace',1);r.onsuccess=()=>resolve(r.result)});
    return new Promise(resolve=>{const r=db.transaction('files').objectStore('files').getAll();r.onsuccess=()=>resolve(r.result.find(f=>f.desktopId==='approved-file'))});
  });
  assert.equal(record.mode,'desktop');assert.equal(record.path,original);assert.equal(record.file,undefined);
  assert.equal((await(await request('status')).json()).folderCount,0);
  await page.locator('#viewport').dispatchEvent('drop',{dataTransfer:await page.evaluateHandle(()=>{
    const d=new DataTransfer();d.items.add(new File(['drop'],'원본 문서.txt'));return d;
  }),clientX:700,clientY:450});
  await page.locator('.file-open').filter({hasText:'원본 문서.txt'}).nth(1).waitFor();
  assert.equal(pickerRequests,0);
  assert.equal(await page.evaluate(()=>window.nativePathMessages),2);
  assert.equal(await page.locator('#native-picker-form').count(),0);
  // Drop into a drawer routes the real registered original into its list.
  await page.locator('[data-add=drawer]').click();
  const drawer=page.locator('.block-drawer');await drawer.locator('[data-drawer-toggle]').click();
  await drawer.dispatchEvent('drop',{dataTransfer:await page.evaluateHandle(()=>{
    const d=new DataTransfer();d.items.add(new File(['drop'],'원본 문서.txt'));return d;
  }),clientX:700,clientY:450});
  await drawer.locator('.file-open').filter({hasText:'원본 문서.txt'}).waitFor();
  assert.equal(pickerRequests,0);assert.equal(await page.evaluate(()=>window.nativePathMessages),3);
  // Manual path fallback also works without any registered folder.
  await page.locator('[data-action=path-shortcut]').click();await page.locator('[name=paths]').fill(original);await page.locator('#save-path').click();
  await page.locator('#path-form').waitFor({state:'detached'});
  // Real PDF rendering runs under the helper's actual CSP, with no external assets.
  const pdfFile=path.join(root,'real-first-page.pdf');await cp('tests/fixtures/first-page.pdf',pdfFile);
  await page.locator('[data-action=path-shortcut]').click();await page.locator('[name=paths]').fill(pdfFile);await page.locator('#save-path').click();
  const pdfCard=page.locator('.file-open').filter({hasText:'real-first-page.pdf'});await pdfCard.waitFor();await pdfCard.hover();
  const image=page.locator('#hover-preview img[alt="PDF 첫 페이지 이미지"]');await image.waitFor();
  assert.ok(await image.evaluate(i=>i.complete&&i.naturalWidth>0));
  // Simulate Office's exported first-page PDF at the platform boundary, render it for real.
  const docFile=path.join(root,'office-first.doc');await writeFile(docFile,'fixture');
  await page.route('**/api/preview-start',route=>route.fulfill({json:{id:'office-test'}}));
  await page.route('**/api/job',async route=>{
    if(route.request().postDataJSON().id==='office-test')return route.fulfill({json:{format:'pdf',source:'Word 첫 페이지'}});
    return route.continue();
  });
  await page.route('**/api/job-content',async route=>route.fulfill({contentType:'application/pdf',body:await readFile('tests/fixtures/first-page.pdf')}));
  await page.locator('[data-action=path-shortcut]').click();await page.locator('[name=paths]').fill(docFile);await page.locator('#save-path').click();
  const docCard=page.locator('.file-open').filter({hasText:'office-first.doc'});await docCard.waitFor();
  await docCard.locator('..').locator('[data-preview-file]').click();
  await page.locator('#preview-body img[alt="첫 페이지 이미지 미리보기"]').waitFor();
  assert.match(await page.locator('#preview-body').textContent(),/Word 첫 페이지/);
  const red=await page.locator('#preview-body img').evaluate(i=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);return x.getImageData(20,20,1,1).data[0]});
  assert.ok(red>240);assert.deepEqual(errors,[]);
  const exited=once(child,'exit');
  assert.equal((await request('shutdown')).status,200);
  await exited;assert.equal(child.exitCode,0);
  console.log('PASS: native File-path boundary (mocked), real folder-free registration/read, drawer drop without confirmation/picker, original open handoff without downloads, isolated workers, PDF/Office rendering under actual CSP, authenticated clean shutdown. WebView2 host, Windows dialogs, ShellExecute and Office COM remain Windows checks.');
} finally {
  await browser?.close();child.kill();if(child.exitCode===null)await once(child,'exit');await rm(root,{recursive:true,force:true});
}

import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp, mkdir, writeFile, readFile, cp, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {once} from 'node:events';
import {chromium} from '@playwright/test';
const root = await mkdtemp(path.join(os.tmpdir(), 'moa-helper-'));
const port = 17844;
const origin = `http://127.0.0.1:${port}`;
const profile = path.join(root,'data');
const docs = path.join(root,'docs');
await mkdir(docs); await mkdir(profile);
const original = path.join(docs,'실제 원본.txt');
const timestamp = 1700000000000;
const {utimes} = await import('node:fs/promises');
await writeFile(original,'원본 내용'); await utimes(original, timestamp/1000, timestamp/1000);
await writeFile(path.join(profile,'links.json'),JSON.stringify({entries:{'approved-file':original},roots:[docs]}));
await cp('windows/Moa-Local.ps1',path.join(root,'Moa-Local.ps1'));
await cp('모아.html',path.join(root,'모아.html'));
const executable = process.env.MOA_POWERSHELL || (process.platform === 'win32' ? 'powershell.exe' : 'pwsh');
let output = '';
const child = spawn(executable,['-NoLogo','-NoProfile','-File',path.join(root,'Moa-Local.ps1'),'-NoBrowser','-Port',String(port),'-DataDirectory',profile],{env:process.env});
child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
let browser;
try {
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('helper startup timed out: '+output)),15000);
    const check=setInterval(()=>{
      if(output.includes(origin)){clearInterval(check);clearTimeout(timeout);resolve();}
      else if(child.exitCode!==null){clearInterval(check);clearTimeout(timeout);reject(Error(output));}
    },100);
    child.once('error',e=>{clearInterval(check);clearTimeout(timeout);reject(e)});
  });
  console.log('Helper started');
  const html=await (await fetch(origin)).text();
  const token=html.match(/window\.moaLocal=\{token:"([a-f0-9]+)"/)[1];
  const request=(route,body={},headers={})=>fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Moa-Token':token,...headers},body:JSON.stringify(body)});
  assert.equal((await request('read',{id:'approved-file'},{'X-Moa-Token':'wrong'})).status,403);
  assert.equal((await request('read',{id:'approved-file'},{Origin:'https://evil.example'})).status,403);
  const wrongHost = await new Promise((resolve,reject)=>{
    const req=http.request(origin+'/',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode)});
    req.on('error',reject);req.end();
  });
  assert.equal(wrongHost,403);
  assert.equal((await request('open',{id:original})).status,400);
  assert.equal((await request('read',{id:'approved-file'})).status,200);
  console.log('Access checks passed');
  const metadata={name:path.basename(original),size:Buffer.byteLength('원본 내용'),lastModified:timestamp};
  const result=await (await request('resolve',{files:[metadata]})).json();
  assert.equal(result.files[0].path,original);
  assert.equal(result.files[0].id,'approved-file');
  await writeFile(original,'수정된 원본의 최신 내용');
  assert.equal(await (await request('read',{id:'approved-file'})).text(),'수정된 원본의 최신 내용');
  assert.equal((await request('resolve',{files:[metadata]})).status,400);
  const updated={...metadata,size:Buffer.byteLength('수정된 원본의 최신 내용')};
  const {stat}=await import('node:fs/promises');
  updated.lastModified=(await stat(original)).mtimeMs;
  await mkdir(path.join(docs,'duplicate'));
  const duplicate=path.join(docs,'duplicate',path.basename(original));
  await cp(original,duplicate); await utimes(duplicate,updated.lastModified/1000,updated.lastModified/1000);
  const ambiguous=await request('resolve',{files:[updated]});
  assert.equal(ambiguous.status,400);
  assert.match((await ambiguous.json()).error,/여러 개/);
  await rm(duplicate);
  console.log('Read and drop matching passed');
  browser=await chromium.launch({executablePath:process.env.MOA_CHROMIUM || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[]; page.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER ERROR',e.message)});page.on('console',m=>{if(m.type()==='error')console.log('BROWSER CONSOLE',m.text())});
  await page.goto(origin);
  page.setDefaultTimeout(10000);
  await page.locator('#canvas').waitFor();
  assert.equal(await page.evaluate(()=>!!window.moaDesktop),true);
  const bounds=await page.locator('#canvas').boundingBox();
  await page.locator('#viewport').dispatchEvent('drop',{
    dataTransfer:await page.evaluateHandle((m)=>{
      const d=new DataTransfer();d.items.add(new File(['수정된 원본의 최신 내용'],m.name,{lastModified:m.lastModified}));return d;
    },updated),clientX:bounds.x+300,clientY:bounds.y+360,
  });
  console.log('Drop dispatched');
  const card=page.locator('.file-open').filter({hasText:updated.name});
  await card.waitFor();
  assert.match(await card.getAttribute('title'),/실제 원본/);
  const block=card.locator('..');
  assert.equal(await block.evaluate(el=>parseFloat(el.style.left)%20),0);
  await card.hover();
  await page.getByText('수정된 원본의 최신 내용',{exact:true}).waitFor();
  let opened;
  await page.route('**/api/open',async route=>{
    opened=route.request().postDataJSON();
    await route.fulfill({json:{opened:true}});
  });
  await card.click();
  await page.waitForTimeout(100);
  assert.equal(opened.id,'approved-file');
  assert.equal(await page.locator('.modal').count(),0);
  await page.locator('#media-input').setInputFiles(path.resolve('tests/fixtures/clip.webm'));
  const video = page.locator('.media-content video');
  await video.waitFor();
  await page.waitForFunction(() => document.querySelector('.media-content video')?.readyState >= 1);
  await page.locator('[data-add=checkbox]').click();
  await page.locator('.block-checkbox input').check();
  assert.equal(await page.locator('.canvas-meta').count(), 0);
  await page.screenshot({path:path.join(root,'board.png')});
  assert.deepEqual(errors,[]);
  const stored=JSON.parse(await readFile(path.join(profile,'links.json'),'utf8'));
  assert.equal(stored.entries['approved-file'],original);
  console.log('PASS: real PowerShell HTTP server, origin/token/path checks, latest source reads, ambiguous drop rejection, browser drop registration, native open request.');
} finally {
  await browser?.close();
  child.kill();
  if(child.exitCode===null)await once(child,'exit');
  await rm(root,{recursive:true,force:true});
}

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import PDFWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';
// Include PDF's CJK character maps and standard fonts for offline Korean documents.
const maps = import.meta.glob('../node_modules/pdfjs-dist/cmaps/*.bcmap', {eager:true, query:'?url&inline', import:'default'});
const fonts = import.meta.glob('../node_modules/pdfjs-dist/standard_fonts/*.{pfb,ttf}', {eager:true, query:'?url&inline', import:'default'});
const decoded = new Map();
function asset(table, name) {
  const key = Object.keys(table).find(key=>key.endsWith('/'+name));
  if(!key) throw Error('PDF 글꼴/문자표를 찾을 수 없습니다: '+name);
  if(!decoded.has(key)) {
    const binary=atob(table[key].split(',')[1]);
    decoded.set(key,Uint8Array.from(binary,c=>c.charCodeAt(0)));
  }
  return decoded.get(key).slice();
}
class CharacterMaps { async fetch({name}) { return {cMapData:asset(maps,name+'.bcmap'),compressionType:1}; } }
class StandardFonts { async fetch({filename}) { return asset(fonts,filename); } }
export async function firstPDFPage(bytes) {
  const worker = new PDFWorker();
  GlobalWorkerOptions.workerPort = worker;
  const task = getDocument({data:new Uint8Array(bytes),useSystemFonts:true,isEvalSupported:false,CMapReaderFactory:CharacterMaps,StandardFontDataFactory:StandardFonts});
  let document;
  try {
    document = await task.promise;
    const page = await document.getPage(1);
    const initial = page.getViewport({scale:1});
    const viewport = page.getViewport({scale:Math.min(2,1200/initial.width)});
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'}).promise;
    const blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if (!blob) throw Error('PDF 첫 페이지 이미지를 만들 수 없습니다.');
    return URL.createObjectURL(blob);
  } finally {
    try { if(document) await document.destroy(); else await task.destroy(); }
    finally { if(GlobalWorkerOptions.workerPort === worker) GlobalWorkerOptions.workerPort = null; worker.terminate(); }
  }
}

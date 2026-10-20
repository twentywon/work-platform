import JSZip from 'jszip';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const zip=new JSZip();
const html=await readFile(path.join(root,'모아.html'));
zip.file('모아.html',html);
zip.file('사용방법.txt',`모아 HTML 버전\n\n1. ZIP 파일을 먼저 압축 해제하세요.\n2. 모아.html을 Chrome 또는 Edge로 여세요. 별도 설치는 필요하지 않습니다.\n3. 페이지 편집과 파일 미리보기를 사용할 수 있습니다.\n\n중요: HTML 버전의 파일 클릭은 브라우저 미리보기입니다. Windows 기본 연결 프로그램으로 원본을 직접 실행하는 기능은 HTML만으로 지원되지 않습니다.\n작업은 현재 브라우저에 저장되므로 같은 브라우저와 같은 HTML 파일 경로를 유지하세요.\n\n계속 수정할 소스는 개발용소스 폴더에 있습니다. Node.js 22.12 이상을 설치한 개발 환경에서 npm ci 후 npm run package:html을 실행하면 HTML 갱신과 ZIP 생성을 함께 수행합니다.\n`);
const items=['src','desktop','build','tests','scripts','index.html','package.json','package-lock.json','README.md','AGENTS.md','.gitignore','vite.config.js','vite.html.config.js','playwright.config.js','playwright.html.config.js','electron-builder.yml'];
async function add(relative){
 const absolute=path.join(root,relative);
 const {stat}=await import('node:fs/promises');
 const info=await stat(absolute);
 if(info.isDirectory())for(const name of (await readdir(absolute)).sort())await add(path.join(relative,name));
 else zip.file('개발용소스/'+relative.split(path.sep).join('/'),await readFile(absolute));
}
for(const item of items)await add(item);
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const timestamp=parts.year+parts.month+parts.day+'-'+parts.hour+parts.minute+parts.second;
const out=path.join(root,'deliveries',`Moa-HTML-v${pkg.version}-${timestamp}.zip`);
await mkdir(path.dirname(out),{recursive:true});
const buffer=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
await writeFile(out,buffer);
const verified=await JSZip.loadAsync(await readFile(out),{checkCRC32:true});
if(!verified.file('모아.html')||!verified.file('개발용소스/src/main.js'))throw Error('ZIP contents missing');
if(!Buffer.from(await verified.file('모아.html').async('uint8array')).equals(html))throw Error('HTML verification failed');
console.log(`ZIP created and verified: ${out} (${buffer.length} bytes)`);

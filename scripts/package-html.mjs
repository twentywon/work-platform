import JSZip from 'jszip';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const zip=new JSZip();
const html=await readFile(path.join(root,'모아.html'));
zip.file('모아.html',html);
zip.file('모아 실행.cmd',await readFile(path.join(root,'windows/Start-Moa.cmd')));
zip.file('Moa-Local.ps1',await readFile(path.join(root,'windows/Moa-Local.ps1')));
zip.file('Moa-Worker.ps1',await readFile(path.join(root,'windows/Moa-Worker.ps1')));
zip.file('사용방법.txt',`모아 v0.5 · Windows 10/11

1. ZIP을 압축 해제하세요. 이전 도우미 창은 먼저 닫으세요.
2. 모아 실행.cmd를 실행하고 도우미 창을 열어 두세요. EXE나 Node.js 설치는 필요하지 않습니다.
3. 파일 연결 → Windows에서 원본 파일 선택 → 카드 클릭으로 기본 프로그램에서 원본 열기 순서입니다. 폴더를 미리 지정하지 않습니다. 원본 문서는 사본으로 저장하거나 다운로드하지 않습니다.
4. 브라우저로 끌어온 파일은 원본 경로를 숨기므로 Windows 선택 창에서 원본을 한 번 확인합니다. 선택 창이 보이지 않으면 Alt+Tab에서 모아 창을 확인하거나 경로 붙여넣기를 사용하세요. 탐색기에서 파일을 Shift+우클릭 → 경로로 복사 후 붙여넣으면 됩니다.
5. 미리보기는 PDF 첫 페이지 렌더링, HWP/HWPX의 저장된 이미지, Office 저장 미리보기 또는 설치된 Word/Excel/PowerPoint의 읽기 전용 내보내기를 사용합니다. Excel은 첫 시트의 첫 인쇄 페이지, PowerPoint는 첫 슬라이드입니다.
6. 한글 문서에 저장된 이미지가 없으면 Windows 문서 미리보기 제공자를 시도합니다. 이미지 생성이 안 되면 이유와 함께 텍스트·표로 표시합니다. 한글·Office 설치만으로 모든 파일의 첫 페이지 이미지가 보장되지는 않습니다. 저장된 미리보기는 저장 당시 이미지입니다.
7. 선택 창과 Office 변환은 별도 작업으로 실행되어 도우미를 막지 않습니다. 변환은 45초 제한이며 PDF/PNG 임시 결과만 만들고 원본을 수정하지 않습니다. Windows의 실제 선택 창과 Office COM 실행은 사용자 PC에서 확인해야 합니다.
8. 체크박스, 미디어, 달력, 인터넷 링크, 페이지 링크는 도구모음에서 추가합니다. 보드 미디어는 표시용 사본으로 브라우저에 저장합니다.

작업은 같은 브라우저의 http://127.0.0.1:17843 에 저장됩니다. HTML 직접 실행과는 저장 공간이 다릅니다. 이전 버전의 바로가기와 보드는 같은 브라우저에서 유지됩니다.
모아.html만 직접 열면 브라우저 미리보기 모드이며 원본 기본 프로그램 실행과 설치된 Office 변환은 모아 실행.cmd가 필요합니다.

개발용소스에서 npm ci 후 npm run package:html로 수정본을 만듭니다.
`);
const items=['windows','src','desktop','build','tests','scripts','index.html','package.json','package-lock.json','README.md','AGENTS.md','.gitattributes','.gitignore','vite.config.js','vite.html.config.js','playwright.config.js','playwright.html.config.js','electron-builder.yml'];
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
if(!verified.file('모아.html')||!verified.file('개발용소스/src/main.js')||!verified.file('Moa-Worker.ps1')||!verified.file('Moa-Local.ps1')||!verified.file('모아 실행.cmd'))throw Error('ZIP contents missing');
if(!Buffer.from(await verified.file('모아.html').async('uint8array')).equals(html))throw Error('HTML verification failed');
console.log(`ZIP created and verified: ${out} (${buffer.length} bytes)`);

import JSZip from 'jszip';
import {createHash} from 'node:crypto';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const zip=new JSZip();
const html=await readFile(path.join(root,'모아.html'));
zip.file('모아.html',html);
zip.file('모아 실행.cmd',await readFile(path.join(root,'windows/Start-Moa.cmd')));
for(const name of ['Moa-Local.ps1','Moa-Worker.ps1','Moa-App.ps1','Moa-Display.ps1','Moa-Sdk.ps1','Start-Moa.vbs'])zip.file(name,await readFile(path.join(root,'windows',name)));
zip.file('모아 실행.vbs',await readFile(path.join(root,'windows/Start-Moa.vbs')));
async function addRuntime(relative){
 const absolute=path.join(root,'windows',relative);
 const {stat}=await import('node:fs/promises');
 if((await stat(absolute)).isDirectory())for(const name of (await readdir(absolute)).sort())await addRuntime(path.join(relative,name));
 else zip.file(relative.split(path.sep).join('/'),await readFile(absolute));
}
await addRuntime('webview2');
zip.file('사용방법.txt',`모아 v0.7 · Windows 10/11

1. ZIP 전체를 압축 해제하세요. 이전 모아 창과 검은 연결 도우미 창은 먼저 닫으세요.
2. 모아 실행.vbs를 더블클릭하세요. 검은 창 없이 모아 전용 HTML 창이 열립니다. 창을 닫으면 연결 도우미도 종료됩니다. EXE 빌드나 Node.js 설치는 필요하지 않습니다. 모아 실행.cmd도 같은 전용 창을 실행합니다.
시작 시 공식 WebView2 SDK DLL 4개의 SHA256을 확인하고 해당 파일의 다운로드 차단 표시만 자동 해제합니다. 0x80131515 오류가 계속되면 ZIP 파일 우클릭 → 속성 → 차단 해제 후 새 폴더에 다시 압축 해제하세요. 일반 문서나 시스템 보안 설정은 바꾸지 않습니다.
3. Microsoft Edge WebView2 Runtime이 설치되어 있어야 합니다. 없거나 구버전이면 Microsoft 공식 WebView2 안내에 따라 설치/업데이트하세요: https://developer.microsoft.com/microsoft-edge/webview2/
4. 전용 창에 탐색기 파일을 끌어놓으면 원본 확인 창 없이 바로 연결합니다. 파일 연결 버튼으로도 등록할 수 있습니다. 카드 클릭은 등록한 원본을 Windows 기본 프로그램으로 엽니다. 원본 문서를 복사하거나 다운로드하지 않습니다. 폴더 연결은 필요하지 않습니다. 경로 붙여넣기도 가능합니다.
5. 일반 Chrome·Edge와 HTML 직접 실행에서는 네이티브 드래그 경로를 받을 수 없습니다. 원본 연결과 확인 없는 드래그는 전용 창에서 사용하세요. 원본을 옮기거나 삭제하면 다시 연결해야 합니다.
6. 기존 브라우저와 새 전용 창은 보드 저장 공간이 다릅니다! 새 창을 켜 둔 채 기존 Chrome·Edge에서 http://127.0.0.1:17843 을 여세요. 기존 보드의 백업·복원 → 현재 작업 백업 후 새 전용 창의 백업·복원 → 백업 파일 복원으로 옮깁니다. 복원은 현재 보드를 바꿉니다. 백업은 원본 문서를 복사하지 않고 보드와 연결 경로, 보드용 미디어 사본을 포함합니다.
화면 선명도: Windows 모니터별 DPI 배율에 대응하고, 보드는 글자를 목표 배율로 다시 그리는 방식으로 확대합니다. 아래 1:1 버튼은 보드를 100%로 표시하며 배율 숫자를 누르면 가로폭 맞춤으로 돌아갑니다. Windows 125%·150% 및 모니터 이동의 실제 결과는 Windows PC에서 확인해야 합니다.
여백을 드래그해 여러 개체를 선택하고 Shift/Ctrl+클릭으로 더하거나 빼세요. 선택한 개체의 테두리나 손잡이를 서랍 위로 끌어 강조 표시가 나타나면 놓으세요. 여러 개체가 함께 들어갑니다. Esc는 진행 중 드래그를 취소합니다.
삽입 도구모음 아래 한 줄에서 개체 설정을 바꿉니다. 설정 줄은 가로 스크롤됩니다. 텍스트 서식은 개체 전체에 적용합니다. 배경·테두리·크기·회전·잠금·앞뒤 순서와 표·미디어·파일·달력 등 종류별 설정을 제공합니다.
7. 개체 테두리를 누르면 선택됩니다. 선택한 뒤 삭제·복제·이동·크기·회전을 사용할 수 있습니다.
8. 도구모음의 서랍을 추가하고 화살표로 펼치세요. 개체 넣기로 기존 개체를 담거나 파일, 이미지·GIF·영상, 메모, 체크를 추가합니다. 파일을 펼친 서랍에 끌어놓아도 됩니다. 목록의 화살표로 순서 변경/보드로 꺼내기를 할 수 있습니다. 서랍 삭제 시 안의 개체도 보드에서 함께 삭제됩니다. PC 원본 파일은 삭제하지 않습니다. 삭제 취소 버튼 또는 입력 중이 아닐 때 Ctrl+Z로 이번 실행 중 삭제를 되돌릴 수 있습니다.
9. PDF는 실제 첫 페이지, HWP/HWPX는 저장 이미지/Windows 제공자, Office는 읽기 전용 첫 페이지 내보내기로 미리봅니다. Excel은 첫 시트의 첫 인쇄 페이지, PowerPoint는 첫 슬라이드입니다. 생성이 안 되면 이유와 가능한 텍스트·표를 표시합니다. 원본은 수정하지 않습니다.
10. 작업과 연결 기록은 PC 로컬에 저장됩니다. WebView2 저장 공간은 %LOCALAPPDATA%\\MoaWeb\\WebView2, 원본 경로는 %LOCALAPPDATA%\\MoaWeb\\links.json입니다. 주기적으로 백업하세요. HTML만 열면 별도의 미리보기 모드입니다.

Windows의 실제 WebView2 시작·탐색기 드래그·연결 프로그램·Office COM 실행은 Windows PC에서 확인해야 합니다. Linux 검증에서는 브라우저 편집, 실제 PowerShell 서버, 네이티브 경계 모의 테스트를 사용했습니다.
개발용소스에서 npm ci 후 npm run package:html로 수정본을 만듭니다.
Microsoft WebView2 SDK 재배포 DLL의 라이선스와 공식 출처/해시는 webview2 폴더에 포함했습니다.
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
for(const required of ['모아.html','개발용소스/src/main.js','Moa-Worker.ps1','Moa-Local.ps1','Moa-App.ps1','Moa-Display.ps1','Moa-Sdk.ps1','모아 실행.cmd','모아 실행.vbs','Start-Moa.vbs','webview2/Microsoft.Web.WebView2.Core.dll','webview2/Microsoft.Web.WebView2.WinForms.dll','webview2/x64/WebView2Loader.dll','webview2/x86/WebView2Loader.dll','webview2/LICENSE.txt','webview2/PROVENANCE.json'])if(!verified.file(required))throw Error('ZIP content missing: '+required);
const provenance=JSON.parse(await verified.file('webview2/PROVENANCE.json').async('string'));
for(const [name,expected] of Object.entries(provenance.sha256))if(createHash('sha256').update(await verified.file('webview2/'+name).async('nodebuffer')).digest('hex')!==expected)throw Error('SDK hash mismatch: '+name);
if(!Buffer.from(await verified.file('모아.html').async('uint8array')).equals(html))throw Error('HTML verification failed');
console.log(`ZIP created and verified: ${out} (${buffer.length} bytes)`);

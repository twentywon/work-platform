import JSZip from 'jszip';
import {createHash} from 'node:crypto';
import {readFile,readdir,mkdir,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const zip=new JSZip();
const html=await readFile(path.join(root,'코션.html'));
zip.file('licenses/Title-Font-OFL.txt',await readFile(path.join(root,'src/assets/OFL-NotoSerifKR.txt')));
zip.file('licenses/Title-Font-Provenance.json',await readFile(path.join(root,'src/assets/title-font-provenance.json')));
zip.file('코션.html',html);
zip.file('코션 실행.vbs',await readFile(path.join(root,'windows/Start-Cotion.vbs')));
for(const name of ['Moa-Local.ps1','Moa-Worker.ps1','Moa-App.ps1','Moa-Display.ps1','Moa-Sdk.ps1'])zip.file(name,await readFile(path.join(root,'windows',name)));
async function addFiles(relative, prefix = '', sourceRoot = root) {
 const absolute = path.join(sourceRoot, relative);
 if ((await stat(absolute)).isDirectory()) {
  for (const name of (await readdir(absolute)).sort()) await addFiles(path.join(relative, name), prefix, sourceRoot);
 } else zip.file(prefix + relative.split(path.sep).join('/'), await readFile(absolute));
}
await addFiles('webview2', '', path.join(root, 'windows'));
await addFiles('assets/cotion.ico', '', path.join(root, 'windows'));
zip.file('사용방법.txt',`코션 v0.10.1 · Windows 10/11

1. ZIP 전체를 새 빈 폴더에 압축 해제하세요. 구버전 폴더에 덮어쓰면 이전 파일이 남습니다. 이전 코션 창과 검은 연결 도우미 창은 먼저 닫으세요.
2. 코션 실행.vbs를 더블클릭하세요. 검은 창 없이 코션 전용 HTML 창이 열립니다. 창을 닫으면 연결 도우미도 종료됩니다. EXE 빌드나 Node.js 설치는 필요하지 않습니다. 실행 진입점은 코션 실행.vbs 하나입니다.
시작 시 공식 WebView2 SDK DLL 4개의 SHA256을 확인하고 해당 파일의 다운로드 차단 표시만 자동 해제합니다. 0x80131515 오류가 계속되면 ZIP 파일 우클릭 → 속성 → 차단 해제 후 새 폴더에 다시 압축 해제하세요. 일반 문서나 시스템 보안 설정은 바꾸지 않습니다.
3. Microsoft Edge WebView2 Runtime이 설치되어 있어야 합니다. 없거나 구버전이면 Microsoft 공식 WebView2 안내에 따라 설치/업데이트하세요: https://developer.microsoft.com/microsoft-edge/webview2/
4. 전용 창에 탐색기 파일을 끌어놓으면 원본 확인 창 없이 바로 연결합니다. 파일 연결 버튼으로도 등록할 수 있습니다. 카드 클릭은 등록한 원본을 Windows 기본 프로그램으로 엽니다. 원본 문서를 복사하거나 다운로드하지 않습니다. 폴더 연결은 필요하지 않습니다. 파일 연결 창의 ‘파일 선택이 열리지 않나요?’에서 경로 붙여넣기도 가능합니다.
5. 일반 Chrome·Edge와 HTML 직접 실행에서는 네이티브 드래그 경로를 받을 수 없습니다. 원본 연결과 확인 없는 드래그는 전용 창에서 사용하세요. 원본을 옮기거나 삭제하면 다시 연결해야 합니다.
6. 기존 브라우저와 새 전용 창은 보드 저장 공간이 다릅니다! 새 창을 켜 둔 채 기존 Chrome·Edge에서 http://127.0.0.1:17843 을 여세요. 기존 보드의 백업·복원 → 현재 작업 백업 후 새 전용 창의 백업·복원 → 백업 파일 복원으로 옮깁니다. 복원은 현재 보드를 바꿉니다. 백업은 원본 문서를 복사하지 않고 보드와 연결 경로, 보드용 미디어 사본을 포함합니다.
화면 선명도: Windows 모니터별 DPI 배율에 대응하고, 보드는 글자를 목표 배율로 다시 그리는 방식으로 확대합니다. 아래 1:1 버튼은 보드를 100%로 표시하며 배율 숫자를 누르면 가로폭 맞춤으로 돌아갑니다. Windows 125%·150% 및 모니터 이동의 실제 결과는 Windows PC에서 확인해야 합니다.
여백을 드래그해 여러 개체를 선택하고 Shift/Ctrl+클릭으로 더하거나 빼세요. 선택한 개체의 테두리나 손잡이를 서랍 위로 끌어 강조 표시가 나타나면 놓으세요. 여러 개체가 함께 들어갑니다. Esc는 진행 중 드래그를 취소합니다.
삽입 도구모음 아래 한 줄에서 개체 설정을 바꿉니다. 설정 줄은 가로 스크롤됩니다. 텍스트 서식은 개체 전체에 적용합니다. 배경·테두리와 표·미디어·파일·달력 등 종류별 설정을 제공합니다. 위치·크기·회전·잠금·앞뒤 순서·서랍 넣기·복제·삭제는 개체 우클릭 메뉴에 있습니다. Shift+F10으로도 엽니다. 한 단계 앞으로/뒤로와 왼쪽 90도 회전·회전 초기화를 추가했습니다. 확인한 Microsoft 공식 자료와 한글 도움말 열람 제한은 개발용소스/docs/editor-reference-review.md에 기록했습니다. 개체 정렬과 상단 개체 메뉴 버튼은 제거했습니다. Esc 또는 바깥 클릭으로 닫습니다. 표 삽입 시 줄·칸 수, 너비·높이, 첫 줄 제목을 설정합니다. 미디어·달력·링크는 상단 도구모음에 바로 표시합니다. 링크 창에서 인터넷 주소 또는 보드 페이지를 선택합니다. 우클릭 → 링크 삽입으로 개체 자체에 링크를 적용하고 클릭하면 이동합니다. F2는 내용 편집, Esc는 편집 종료, Ctrl+K는 링크 설정입니다. 우클릭의 개체 붙여넣기는 이 앱에서 복사한 개체를 사용하며 외부 내용은 Ctrl+V를 사용하세요. 줄 체크는 커서를 놓고 취소선 옆 체크 버튼으로 적용하며 체크하면 해당 줄 전체에 취소선이 표시됩니다. Enter는 다음 체크 줄, 빈 체크 줄에서 Enter는 체크 종료입니다. 기존 체크 개체는 줄 체크 텍스트로 이전합니다.
단축키: Ctrl+C/X/V 개체 복사·잘라내기·붙여넣기, Ctrl+D 복제, Ctrl+Z 취소, Ctrl+Y 또는 Ctrl+Shift+Z 다시 실행, Ctrl+A 전체 선택, Ctrl+S 저장, Ctrl+N 새 페이지, Ctrl+O 파일 연결. 글자 입력 칸에서는 일반 텍스트 복사/붙여넣기를 유지합니다. 텍스트 개체는 Ctrl+B/I/U로 굵게/기울임/밑줄, Ctrl+Shift+X 취소선, Ctrl+L/E/R 왼쪽/가운데/오른쪽 정렬을 적용합니다. 방향키 1px, Shift+방향키 10px 이동, Delete 삭제, Esc 선택 취소, F2 내용 편집, Enter 파일 열기 또는 서랍 펼치기입니다.
일반 취소/다시 실행은 개체·서식·위치·페이지 변경을 되돌립니다. 개별 삭제 취소 버튼은 다른 수정 내용을 유지하면서 삭제한 개체만 복구합니다. 취소 기록은 현재 실행 중에만 유지됩니다.
텍스트 상자는 긴 단어와 직접 입력한 여러 줄을 표시하고, 크기를 늘리면 표시 영역도 늘어납니다. 회전은 중심과 저장된 X/Y/너비/높이를 유지합니다. 페이지 경계의 회전된 부분은 보드 밖으로 보일 수 있습니다.
달력 글자는 개체의 가로·세로 크기에 따라 조절되며 날짜는 왼쪽 위에 표시합니다. 서랍 위 휠은 서랍 내부 목록을 스크롤합니다. 새 도형은 처음에만 정비율입니다. 이후 손잡이와 너비·높이 입력은 자유롭게 변경하며 Shift 드래그만 임시로 비율을 유지합니다.
사각형·원 외에 둥근 사각형, 삼각형, 마름모, 오각형, 육각형, 별, 화살표, 평행사변형, 말풍선, 하트를 추가했습니다. 저장된 기존 보드는 같은 저장 공간에서 유지됩니다.
작업표시줄 아이콘은 전용 창에 지정했습니다. Windows 실제 작업표시줄 표시와 클립보드 동작은 사용자 PC에서 확인해야 합니다.
7. 개체 테두리를 누르면 선택됩니다. 선택한 뒤 삭제·복제·이동·크기·회전을 사용할 수 있습니다.
8. 도구모음의 서랍을 추가하고 화살표로 펼치세요. 개체 넣기로 기존 개체를 담거나 파일, 이미지·GIF·영상, 메모를 추가합니다. 파일을 펼친 서랍에 끌어놓아도 됩니다. 목록의 화살표로 순서 변경/보드로 꺼내기를 할 수 있습니다. 서랍 삭제 시 안의 개체도 보드에서 함께 삭제됩니다. PC 원본 파일은 삭제하지 않습니다. 삭제 취소 버튼 또는 입력 중이 아닐 때 Ctrl+Z로 이번 실행 중 삭제를 되돌릴 수 있습니다.
9. PDF는 실제 첫 페이지, HWP/HWPX는 저장 이미지/Windows 제공자, Office는 읽기 전용 첫 페이지 내보내기로 미리봅니다. Excel은 첫 시트의 첫 인쇄 페이지, PowerPoint는 첫 슬라이드입니다. 생성이 안 되면 이유와 가능한 텍스트·표를 표시합니다. 원본은 수정하지 않습니다.
10. 작업과 연결 기록은 PC 로컬에 저장됩니다. WebView2 저장 공간은 %LOCALAPPDATA%\\MoaWeb\\WebView2, 원본 경로는 %LOCALAPPDATA%\\MoaWeb\\links.json입니다. 주기적으로 백업하세요. HTML만 열면 별도의 미리보기 모드입니다.

Windows의 실제 WebView2 시작·탐색기 드래그·연결 프로그램·Office COM 실행은 Windows PC에서 확인해야 합니다. Linux 검증에서는 브라우저 편집, 실제 PowerShell 서버, 네이티브 경계 모의 테스트를 사용했습니다.
개발용소스에서 npm ci 후 npm run package:html로 수정본을 만듭니다.
Microsoft WebView2 SDK 재배포 DLL의 라이선스와 공식 출처/해시는 webview2 폴더에 포함했습니다.
`);
const items=['docs','windows','src','desktop','build','tests','scripts','index.html','package.json','package-lock.json','README.md','AGENTS.md','.gitattributes','.gitignore','vite.config.js','vite.html.config.js','playwright.config.js','playwright.html.config.js','electron-builder.yml'];
for(const item of items)await addFiles(item, '개발용소스/');
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const timestamp=process.env.COTION_RELEASE_DATE||parts.year+parts.month+parts.day+'-'+parts.hour+parts.minute+parts.second;
if(!/^\d{8}(?:-\d{6})?$/.test(timestamp))throw Error('Invalid release date');
const out=path.join(root,'deliveries',`Cotion-HTML-v${pkg.version}-${timestamp}.zip`);
await mkdir(path.dirname(out),{recursive:true});
const buffer=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
await writeFile(out,buffer);
const verified=await JSZip.loadAsync(await readFile(out),{checkCRC32:true});
for(const required of ['코션.html','코션 실행.vbs','assets/cotion.ico','개발용소스/src/main.js','개발용소스/src/line-editor.js','개발용소스/src/table.js','개발용소스/src/links.js','사용방법.txt','Moa-Worker.ps1','Moa-Local.ps1','Moa-App.ps1','Moa-Display.ps1','Moa-Sdk.ps1','webview2/Microsoft.Web.WebView2.Core.dll','webview2/Microsoft.Web.WebView2.WinForms.dll','webview2/x64/WebView2Loader.dll','webview2/x86/WebView2Loader.dll','webview2/LICENSE.txt','webview2/PROVENANCE.json'])if(!verified.file(required))throw Error('ZIP content missing: '+required);
for(const obsolete of ['모아.html','모아 실행.vbs','모아 실행.cmd','코션 실행.cmd','Start-Moa.vbs','Start-Cotion.vbs','assets/cotion.png'])if(verified.file(obsolete))throw Error('Obsolete ZIP entry: '+obsolete);
const ico=await verified.file('assets/cotion.ico').async('nodebuffer');
if(ico.readUInt16LE(0)!==0||ico.readUInt16LE(2)!==1||ico.readUInt16LE(4)<7)throw Error('Invalid multi-resolution taskbar icon');
const provenance=JSON.parse(await verified.file('webview2/PROVENANCE.json').async('string'));
for(const [name,expected] of Object.entries(provenance.sha256))if(createHash('sha256').update(await verified.file('webview2/'+name).async('nodebuffer')).digest('hex')!==expected)throw Error('SDK hash mismatch: '+name);
if(!Buffer.from(await verified.file('코션.html').async('uint8array')).equals(html))throw Error('HTML verification failed');
console.log(`ZIP created and verified: ${out} (${buffer.length} bytes)`);

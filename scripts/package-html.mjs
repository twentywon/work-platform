import JSZip from 'jszip';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const zip=new JSZip();
const html=await readFile(path.join(root,'모아.html'));
zip.file('모아.html',html);
zip.file('모아 실행.cmd',await readFile(path.join(root,'windows/Start-Moa.cmd')));
zip.file('Moa-Local.ps1',await readFile(path.join(root,'windows/Moa-Local.ps1')));
zip.file('사용방법.txt',`모아 v0.2 · Windows 10/11

1. ZIP을 반드시 압축 해제하세요.
2. 모아 실행.cmd를 더블클릭하세요. 브라우저가 자동으로 열립니다. Node.js나 EXE 설치가 필요하지 않습니다.
3. 함께 뜨는 연결 도우미 창은 열어 두세요. 창을 닫으면 원본 파일 열기가 중단됩니다. 종료는 Ctrl+C 또는 창 닫기입니다.
4. 파일 연결 버튼으로 원본을 선택하면 카드 클릭 시 PC 기본 연결 프로그램(한글, Excel 등)으로 원본을 엽니다. 파일을 내려받거나 사본을 만들지 않습니다.
5. 드래그할 파일이 있는 연결 폴더를 한 번 지정하세요. 그 폴더와 하위 폴더의 파일을 보드로 끌어 놓으면 놓은 위치에 바로가기를 만듭니다. 이름·크기·수정 시각으로 원본을 찾습니다. 후보가 여러 개면 임의로 열지 않으며 파일 연결 버튼으로 정확한 원본을 선택하세요. 여러 연결 폴더를 추가할 수 있습니다. 폴더를 이동했으면 새 위치를 추가하세요.
6. 손잡이로 개체를 이동·크기 조절하면 20px 격자에 맞춥니다. 회전 손잡이는 15도 간격, 선택 도구모음은 각도 직접 입력 및 90도 회전을 지원합니다.
7. 보드는 가로폭에 맞춰 표시하며 세로는 스크롤합니다. 위쪽 경로에서 작은 페이지 이름을 변경할 수 있습니다.

주의: 모아.html만 직접 열면 브라우저 미리보기 모드입니다. 원본을 PC 프로그램에서 열려면 모아 실행.cmd를 사용하세요. 회사 정책이 PowerShell 실행을 차단하면 연결 도우미를 사용할 수 없으며 IT 담당자 확인이 필요합니다.

작업은 같은 브라우저의 http://127.0.0.1:17843 에 저장됩니다. 기존 HTML을 직접 열어 작성한 데이터와는 저장 공간이 다릅니다. 사이트 데이터를 지우지 마세요. 원본 경로와 연결 폴더는 PC의 %LOCALAPPDATA%\\MoaWeb\\links.json 에 저장됩니다. 원본을 이동·삭제하면 다시 연결하세요.
이 PC 밖으로 파일을 업로드하지 않습니다. 같은 PC의 브라우저에서만 연결 도우미에 접근할 수 있습니다.

개발용소스에서 npm ci 후 npm run package:html로 수정본을 만듭니다. Windows의 실제 한글/Office 실행은 사용자 PC에서 확인해야 합니다.
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
if(!verified.file('모아.html')||!verified.file('개발용소스/src/main.js'))throw Error('ZIP contents missing');
if(!Buffer.from(await verified.file('모아.html').async('uint8array')).equals(html))throw Error('HTML verification failed');
console.log(`ZIP created and verified: ${out} (${buffer.length} bytes)`);

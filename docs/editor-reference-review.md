# 편집 기능 자료 확인 · 2026-10-21

v0.10.1에서 실제로 읽은 공식 자료와 적용 범위를 기록합니다. 이전 v0.10 작업은 일반적인 편집 프로그램 관례를 바탕으로 구현했으며 한글·Microsoft 공식 UI 자료를 조사했다고 주장할 근거가 없었습니다.

| 실제 열람한 자료 | 확인한 내용 | 코션에 적용한 내용 |
| --- | --- | --- |
| [Microsoft PowerPoint Shape.LockAspectRatio](https://raw.githubusercontent.com/MicrosoftDocs/VBA-Docs/main/api/PowerPoint.Shape.LockAspectRatio.md) | `msoFalse`는 가로·세로를 독립적으로 변경하며 `msoTrue`는 비율을 유지합니다. | 사용자 요청에 따라 처음 생성할 때만 정비율. 이후 손잡이와 숫자 입력은 자유롭게 조절. v0.10의 자동 비율 잠금과 메뉴 항목 제거. 기존 데이터의 keepAspect 값도 강제하지 않음. Shift 드래그는 선택적인 임시 비율 유지. |
| [Microsoft PowerPoint Shape.ZOrder](https://raw.githubusercontent.com/MicrosoftDocs/VBA-Docs/main/api/PowerPoint.Shape.ZOrder.md) | `msoBringForward`, `msoSendBackward`, `msoBringToFront`, `msoSendToBack`을 구분합니다. | 기존 맨 앞으로/뒤로에 한 단계 앞으로/뒤로 추가. 다중 선택의 상대 순서와 서랍 소속, 원본 파일 ID 유지. |
| [Microsoft PowerPoint Shape.Rotation](https://raw.githubusercontent.com/MicrosoftDocs/VBA-Docs/main/api/PowerPoint.Shape.Rotation.md) | 양수 각도는 시계 방향, 음수는 반시계 방향입니다. | 오른쪽 90° 외에 왼쪽 90°·회전 초기화 추가. 위치·크기를 유지하며 실행 취소 지원. |
| [Microsoft PowerPoint shapes 가이드](https://raw.githubusercontent.com/OfficeDev/office-js-docs-pr/main/docs/powerpoint/shapes.md) | 도형 생성·이동·크기 변경·그룹화 API를 설명합니다. | 기존 좌표·크기 모델과 검토. 영구 그룹화는 이번에 추가하지 않음. |

위 자료는 Microsoft 공식 API 문서입니다. Word·PowerPoint의 실제 실행 화면이나 전체 우클릭 UI를 직접 검토한 것으로 표현하면 안 됩니다. 기존 복사·잘라내기·붙여넣기·Ctrl+K·F2 기능은 이번에 새로 조사·추가했다고 주장하지 않습니다.

## 확인하지 못한 자료

- [한컴 공식 도움말](https://help.hancom.com/)과 support.microsoft.com의 도움말 직접 접속은 관리 클라우드 프록시에서 HTTP CONNECT 403으로 차단되었습니다. 문서 본문을 열람하지 못했습니다.
- 네트워크 정책에 두 호스트가 허용되어 있지 않음을 확인했습니다. 프록시나 접근 정책을 우회하지 않았습니다.
- 따라서 한글의 실제 메뉴 구성·단축키 또는 최신 Word/PowerPoint UI와 완전히 같다고 주장하지 않습니다.
- Windows의 실제 한글·Microsoft Office 실행 화면은 이 Linux 환경에서 확인하지 않았습니다.

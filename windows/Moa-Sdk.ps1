# Only official, hash-pinned WebView2 SDK files may have their download-zone marker removed.
function Initialize-MoaSdk {
    param([Parameter(Mandatory=$true)][string]$SdkDirectory)
    $expected = [ordered]@{
        'Microsoft.Web.WebView2.Core.dll' = '88a3b62f45225a811cdb85df6dfd95c2bff9a0e43e3b04f813b125eaca56cc9f'
        'Microsoft.Web.WebView2.WinForms.dll' = '29fc954c3fde1749817d158f3dd5ebe9efd3b3ce9708d86092fb1e9f023a1cb0'
        'x64/WebView2Loader.dll' = '462b36fd1be6ca9f7563466a89e57c41ef4a4def3e0a84fa885d203aea4a3aaf'
        'x86/WebView2Loader.dll' = '6f59ad578fde1f65c44b6935dab0901f014b5268e056b930fb34c0919f1bf4b9'
    }
    $files = @()
    foreach ($name in $expected.Keys) {
        $file = Join-Path $SdkDirectory $name
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "WebView2 구성 파일이 없습니다: $name. 최신 ZIP 전체를 새 폴더에 압축 해제하세요." }
        $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256 -ErrorAction Stop).Hash
        if ($hash -ne $expected[$name]) { throw "WebView2 구성 파일이 손상되었거나 배포본과 다릅니다: $name. 최신 ZIP을 다시 다운로드해 압축 해제하세요." }
        $files += $file
    }
    # Validate the entire set before altering any marker. Never unblock user documents or other files.
    foreach ($file in $files) {
        try { Unblock-File -LiteralPath $file -ErrorAction Stop }
        catch { throw "WebView2 다운로드 차단을 해제하지 못했습니다. ZIP 파일 우클릭 → 속성 → 차단 해제 후 새 폴더에 다시 압축 해제하세요. 파일: $file / $($_.Exception.Message)" }
    }
}

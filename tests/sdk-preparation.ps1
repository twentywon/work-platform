$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../windows/Moa-Sdk.ps1')
$root = Join-Path ([IO.Path]::GetTempPath()) ('moa sdk [test] ' + [guid]::NewGuid().ToString())
$isWindowsHost = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT
$script:unblocked = @()
if (-not $isWindowsHost) {
    function Unblock-File {
        param([string]$LiteralPath,[string]$ErrorAction)
        $script:unblocked += $LiteralPath
    }
}
try {
    [void][IO.Directory]::CreateDirectory($root)
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../windows/webview2') -Destination $root -Recurse
    $sdk = Join-Path $root 'webview2'
    $files = @(Get-ChildItem -LiteralPath $sdk -Recurse -Filter '*.dll')
    if ($isWindowsHost) {
        foreach ($file in $files) { Set-Content -LiteralPath $file.FullName -Stream Zone.Identifier -Value "[ZoneTransfer]`r`nZoneId=3" }
    }
    Initialize-MoaSdk -SdkDirectory $sdk
    if ($isWindowsHost) {
        foreach ($file in $files) {
            if (Get-Item -LiteralPath $file.FullName -Stream Zone.Identifier -ErrorAction SilentlyContinue) { throw 'Download marker remains' }
        }
    } elseif ($script:unblocked.Count -ne 4) { throw 'Expected exactly four vendor DLL unblock operations' }
    # Repeating startup is supported.
    Initialize-MoaSdk -SdkDirectory $sdk
    $script:unblocked = @()
    $damaged = Join-Path $sdk 'Microsoft.Web.WebView2.WinForms.dll'
    [IO.File]::AppendAllText($damaged,'tampered')
    $rejected = $false
    try { Initialize-MoaSdk -SdkDirectory $sdk } catch { $rejected = $_.Exception.Message.Contains('Microsoft.Web.WebView2.WinForms.dll') }
    if (-not $rejected -or $script:unblocked.Count -ne 0) { throw 'Tampered SDK must be rejected before any unblock' }
    Remove-Item -LiteralPath $damaged
    $rejected = $false
    try { Initialize-MoaSdk -SdkDirectory $sdk } catch { $rejected = $_.Exception.Message.Contains('Microsoft.Web.WebView2.WinForms.dll') }
    if (-not $rejected -or $script:unblocked.Count -ne 0) { throw 'Missing SDK must be rejected before any unblock' }
    $app = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../windows/Moa-App.ps1') -Raw
    if ($app.IndexOf('Initialize-MoaSdk -SdkDirectory') -gt $app.IndexOf('Add-Type -Path')) { throw 'SDK must be prepared before assembly loading' }
    Write-Output ('PASS: official SDK hashes, repeated preparation, missing/tampered rejection before unblock, preparation before load. Actual Windows ADS tested: ' + $isWindowsHost)
} finally { Remove-Item -LiteralPath $root -Recurse -Force }

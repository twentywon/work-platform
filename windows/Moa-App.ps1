# HTML workspace hosted by WebView2. File objects cross the native bridge with real paths.
param([int]$Port = 17843)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$dataDirectory = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MoaWeb'
[void][IO.Directory]::CreateDirectory($dataDirectory)
$baseUrl = "http://127.0.0.1:$Port/"
$form = $null; $view = $null; $server = $null; $timer = $null
$script:helperToken = $null; $script:initialized = $false
$mutex = New-Object Threading.Mutex($false,'Local\MoaWebViewWorkspace')
$ownsMutex = $false
try {
    $ownsMutex = $mutex.WaitOne(0,$false)
    if (-not $ownsMutex) { throw '모아가 이미 실행 중입니다. 작업 표시줄에서 모아 창을 확인하세요.' }
    $probe = New-Object Net.Sockets.TcpClient
    try { $probe.Connect('127.0.0.1',$Port); throw '이전 모아 연결 도우미가 실행 중입니다. 이전 검은 창 또는 모아 창을 닫고 다시 실행하세요.' }
    catch [Net.Sockets.SocketException] {} finally { $probe.Dispose() }
    $sdk = Join-Path $PSScriptRoot 'webview2'
    . (Join-Path $PSScriptRoot 'Moa-Sdk.ps1')
    Initialize-MoaSdk -SdkDirectory $sdk
    Add-Type -Path (Join-Path $sdk 'Microsoft.Web.WebView2.Core.dll')
    Add-Type -Path (Join-Path $sdk 'Microsoft.Web.WebView2.WinForms.dll')
    $architecture = if ([Environment]::Is64BitProcess) { 'x64' } else { 'x86' }
    [Microsoft.Web.WebView2.Core.CoreWebView2Environment]::SetLoaderDllFolderPath((Join-Path $sdk $architecture))
    try { [void][Microsoft.Web.WebView2.Core.CoreWebView2Environment]::GetAvailableBrowserVersionString($null) }
    catch { throw 'Microsoft Edge WebView2 Runtime이 필요합니다. Microsoft Edge/WebView2 Runtime을 설치 또는 복구한 뒤 다시 실행하세요. https://developer.microsoft.com/microsoft-edge/webview2/' }
    Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Diagnostics;
public static class MoaProcessLog {
  static readonly object Gate=new object();
  public static void Attach(Process process,string filename) {
    DataReceivedEventHandler log=(sender,e)=>{ if(e.Data!=null) { lock(Gate) { try {File.AppendAllText(filename,e.Data+Environment.NewLine);}catch{} } } };
    process.OutputDataReceived+=log; process.ErrorDataReceived+=log;
    process.BeginOutputReadLine(); process.BeginErrorReadLine();
  }
}
'@
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = Join-Path $PSHOME 'powershell.exe'
    $start.Arguments = '-NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "' + (Join-Path $PSScriptRoot 'Moa-Local.ps1') + '" -NoBrowser -Port ' + $Port
    $start.UseShellExecute = $false; $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
    $server = [Diagnostics.Process]::Start($start)
    [MoaProcessLog]::Attach($server,(Join-Path $dataDirectory 'helper.log'))
    $form = New-Object Windows.Forms.Form
    $form.Text = '모아'; $form.Width = 1440; $form.Height = 960
    $form.MinimumSize = New-Object Drawing.Size(800,600)
    $form.StartPosition = [Windows.Forms.FormStartPosition]::CenterScreen
    $view = New-Object Microsoft.Web.WebView2.WinForms.WebView2
    $view.Dock = [Windows.Forms.DockStyle]::Fill
    $view.AllowExternalDrop = $true
    $creation = New-Object Microsoft.Web.WebView2.WinForms.CoreWebView2CreationProperties
    $creation.UserDataFolder = Join-Path $dataDirectory 'WebView2'
    $view.CreationProperties = $creation
    $form.Controls.Add($view)
    $view.add_CoreWebView2InitializationCompleted({
        param($sender,$eventArgs)
        try {
            if (-not $eventArgs.IsSuccess) { throw $eventArgs.InitializationException }
            $core = $view.CoreWebView2
            $core.Settings.AreDevToolsEnabled = $false
            $core.add_NavigationStarting({
                param($s,$event)
                if ($event.Uri -ne $baseUrl -and -not $event.Uri.StartsWith('blob:')) {
                    $event.Cancel = $true
                    $uri = $null
                    if ([Uri]::TryCreate($event.Uri,[UriKind]::Absolute,[ref]$uri) -and $uri.Scheme -in @('http','https')) { Start-Process $uri.AbsoluteUri }
                }
            })
            $core.add_NewWindowRequested({
                param($s,$event)
                $event.Handled = $true
                $uri = $null
                if ([Uri]::TryCreate($event.Uri,[UriKind]::Absolute,[ref]$uri) -and $uri.Scheme -in @('http','https')) { Start-Process $uri.AbsoluteUri }
            })
            $core.add_WebMessageReceived({
                param($sender,$event)
                if ($event.Source -ne $baseUrl) { return }
                $message = $null
                try {
                    $message = $event.WebMessageAsJson | ConvertFrom-Json
                    if ($message.kind -eq 'session') { $script:helperToken = [string]$message.token; return }
                    if ($message.kind -ne 'file-paths' -or ([string]$message.id) -notmatch '^[a-f0-9-]{36}$') { return }
                    $paths = @()
                    foreach ($item in $event.AdditionalObjects) {
                        if ($item -isnot [Microsoft.Web.WebView2.Core.CoreWebView2File]) { throw '원본 파일 정보를 받지 못했습니다.' }
                        if (-not $item.Path) { throw 'PC에 저장된 원본 파일만 연결할 수 있습니다.' }
                        $paths += $item.Path
                    }
                    if ($paths.Count -eq 0 -or $paths.Count -gt 100) { throw '파일은 한 번에 1~100개까지 연결할 수 있습니다.' }
                    $response = @{ id = $message.id; paths = $paths } | ConvertTo-Json -Compress
                    $view.CoreWebView2.PostWebMessageAsJson($response)
                } catch {
                    if ($message -and $message.id) { $view.CoreWebView2.PostWebMessageAsJson((@{id=$message.id; error=$_.Exception.Message}|ConvertTo-Json -Compress)) }
                }
            })
            $view.CoreWebView2.Navigate($baseUrl)
        } catch { [void][Windows.Forms.MessageBox]::Show($_.Exception.Message,'모아 실행 오류'); $form.Close() }
    })
    $timer = New-Object Windows.Forms.Timer
    $timer.Interval = 100
    $script:startupDeadline = [datetime]::UtcNow.AddSeconds(20)
    $timer.add_Tick({
        try {
            if ($server.HasExited) { throw '연결 도우미가 종료되었습니다. %LOCALAPPDATA%\MoaWeb\helper.log를 확인하세요.' }
            if (-not $script:initialized) {
                $probe = New-Object Net.Sockets.TcpClient
                try {
                    $probe.Connect('127.0.0.1',$Port)
                    $script:initialized = $true
                    [void]$view.EnsureCoreWebView2Async($null)
                } catch [Net.Sockets.SocketException] {
                    if ([datetime]::UtcNow -gt $script:startupDeadline) { throw '연결 도우미를 시작하지 못했습니다.' }
                } finally { $probe.Dispose() }
            }
        } catch { $timer.Stop(); [void][Windows.Forms.MessageBox]::Show($_.Exception.Message,'모아 오류'); $form.Close() }
    })
    $timer.Start()
    [Windows.Forms.Application]::Run($form)
} catch { [void][Windows.Forms.MessageBox]::Show($_.Exception.Message,'모아 실행 오류') }
finally {
    if ($timer) { $timer.Stop(); $timer.Dispose() }
    if ($view) { $view.Dispose() }
    if ($server) {
        if (-not $server.HasExited -and $script:helperToken) {
            try {
                $request = [Net.HttpWebRequest]::Create($baseUrl+'api/shutdown')
                $request.Proxy = $null; $request.Timeout = 1500; $request.ReadWriteTimeout = 1500
                $request.Method = 'POST'; $request.ContentType = 'application/json'
                $request.Headers['X-Moa-Token'] = $script:helperToken
                $body = [Text.Encoding]::UTF8.GetBytes('{}'); $request.ContentLength = $body.Length
                $stream = $request.GetRequestStream()
                try { $stream.Write($body,0,$body.Length) } finally { $stream.Dispose() }
                $response = $request.GetResponse(); $response.Dispose()
                [void]$server.WaitForExit(3000)
            } catch {}
        }
        if (-not $server.HasExited) { $server.Kill() }
        $server.Dispose()
    }
    if ($form) { $form.Dispose() }
    if ($ownsMutex) { $mutex.ReleaseMutex() }; $mutex.Dispose()
}

# Windows PowerShell 5.1+, no installation or administrator rights required.
param([switch]$NoBrowser, [int]$Port = 17843, [string]$DataDirectory = '')
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
if (-not $DataDirectory) { $DataDirectory = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MoaWeb' }
[void][IO.Directory]::CreateDirectory($DataDirectory)
$configFile = Join-Path $DataDirectory 'links.json'
$entries = @{}
$roots = @()
if (Test-Path -LiteralPath $configFile) {
    $saved = [IO.File]::ReadAllText($configFile, $utf8) | ConvertFrom-Json
    foreach ($property in $saved.entries.PSObject.Properties) { $entries[$property.Name] = [string]$property.Value }
    $roots = @($saved.roots)
}
$supported = @('.hwp','.hwpx','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.pdf','.png','.jpg','.jpeg','.gif','.webp','.bmp','.svg','.txt','.md','.csv','.json','.log','.odt','.ods','.odp')
function Save-Links {
    $json = @{ entries = $entries; roots = @($script:roots) } | ConvertTo-Json -Depth 6
    [IO.File]::WriteAllText($configFile + '.tmp', $json, $utf8)
    Move-Item -LiteralPath ($configFile + '.tmp') -Destination $configFile -Force
}
function Get-Document([string]$Path) {
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.PSIsContainer -or $supported -notcontains $item.Extension.ToLowerInvariant() -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw '업무 문서와 이미지 원본 파일만 연결할 수 있습니다.'
    }
    return $item
}
function Register-Document([string]$Path) {
    $item = Get-Document $Path
    $id = $null
    foreach ($key in $entries.Keys) { if ($entries[$key] -eq $item.FullName) { $id = $key; break } }
    if (-not $id) { $id = [guid]::NewGuid().ToString(); $entries[$id] = $item.FullName }
    return @{ id = $id; name = $item.Name; path = $item.FullName }
}
function Resolve-Document([string]$Id) {
    if (-not $Id -or -not $entries.ContainsKey($Id)) { throw '등록되지 않은 파일입니다. 파일 연결에서 원본을 다시 선택해 주세요.' }
    return Get-Document $entries[$Id]
}
function Find-DroppedFile($Metadata) {
    $found = New-Object 'System.Collections.Generic.List[string]'
    $queue = New-Object 'System.Collections.Generic.Queue[string]'
    foreach ($root in $script:roots) { if (Test-Path -LiteralPath $root) { $queue.Enqueue($root) } }
    $visited = @{}
    while ($queue.Count -gt 0) {
        $directory = $queue.Dequeue()
        if ($visited.ContainsKey($directory)) { continue }
        $visited[$directory] = $true
        foreach ($item in @(Get-ChildItem -LiteralPath $directory -Force -ErrorAction SilentlyContinue)) {
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
            if ($item.PSIsContainer) { $queue.Enqueue($item.FullName); continue }
            if ($item.Name -ceq $Metadata.name -and $item.Length -eq [long]$Metadata.size) {
                $ms = ($item.LastWriteTimeUtc - [datetime]'1970-01-01').TotalMilliseconds
                if ([Math]::Abs($ms - [double]$Metadata.lastModified) -lt 2000) { $found.Add($item.FullName) }
            }
        }
    }
    return $found.ToArray()
}
function New-DialogOwner {
    Add-Type -AssemblyName System.Windows.Forms
    $owner = New-Object System.Windows.Forms.Form
    $owner.Text = '모아 파일 연결'
    $owner.Size = New-Object System.Drawing.Size(1, 1)
    $owner.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
    $owner.ShowInTaskbar = $false
    $owner.TopMost = $true
    $owner.Opacity = 0
    $owner.Show()
    $owner.Activate()
    $owner.BringToFront()
    return $owner
}
function Select-NativeFiles {
    $owner = New-DialogOwner
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    try {
        Write-Host '파일 선택 창을 표시합니다. 브라우저 앞의 Windows 창에서 선택해 주세요.'
        $dialog.Title = '모아 - 바로가기로 연결할 원본 파일 선택'
        $dialog.Multiselect = $true
        $dialog.RestoreDirectory = $true
        $dialog.Filter = '업무 문서 및 이미지|' + (($supported | ForEach-Object { '*' + $_ }) -join ';')
        if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { return @($dialog.FileNames) }
        return @()
    } finally { $dialog.Dispose(); $owner.Close(); $owner.Dispose() }
}
function Select-NativeFolder {
    $owner = New-DialogOwner
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    try {
        Write-Host '폴더 선택 창을 표시합니다. 브라우저 앞의 Windows 창에서 선택해 주세요.'
        $dialog.Description = '모아 - 드래그할 파일이 있는 폴더를 선택하세요. 하위 폴더도 연결합니다.'
        $dialog.ShowNewFolderButton = $false
        if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { return $dialog.SelectedPath }
        return ''
    } finally { $dialog.Dispose(); $owner.Close(); $owner.Dispose() }
}
function Send-Response($Stream, [int]$Status, [byte[]]$Bytes, [string]$ContentType = 'application/json; charset=utf-8', [hashtable]$Extra = @{}) {
    $header = "HTTP/1.1 $Status Response`r`nContent-Type: $ContentType`r`nContent-Length: $($Bytes.Length)`r`nConnection: close`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nX-Frame-Options: DENY`r`n"
    foreach ($key in $Extra.Keys) { $header += "$($key): $($Extra[$key])`r`n" }
    $header += "`r`n"
    $headBytes = $utf8.GetBytes($header)
    $Stream.Write($headBytes, 0, $headBytes.Length)
    $Stream.Write($Bytes, 0, $Bytes.Length)
}
function Send-Json($Stream, $Object, [int]$Status = 200) {
    $json = ConvertTo-Json -InputObject $Object -Depth 8 -Compress
    Send-Response $Stream $Status ($utf8.GetBytes($json))
}
$tokenBytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($tokenBytes)
$rng.Dispose()
$token = ([BitConverter]::ToString($tokenBytes)).Replace('-', '').ToLowerInvariant()
$baseUrl = "http://127.0.0.1:$Port"
$htmlFile = Join-Path $PSScriptRoot '모아.html'
if (-not (Test-Path -LiteralPath $htmlFile)) { throw 'ZIP을 먼저 압축 해제하고 모아.html과 실행 파일을 같은 폴더에 두세요.' }
$listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $Port)
try { $listener.Start() } catch { throw "모아 연결 도우미를 시작할 수 없습니다. 이미 실행 중이면 $baseUrl 을 여세요. 자세한 내용: $($_.Exception.Message)" }
Write-Host "모아 실행 중: $baseUrl"
Write-Host '이 창을 열어 두세요. 종료하려면 Ctrl+C를 누르거나 창을 닫으세요.'
if (-not $NoBrowser) { Start-Process $baseUrl }
try {
    while ($true) {
        if (-not $listener.Pending()) { Start-Sleep -Milliseconds 50; continue }
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $stream.ReadTimeout = 1000
        $stream.WriteTimeout = 15000
        $route = ''
        try {
            $buffer = New-Object 'System.Collections.Generic.List[byte]'
            while ($true) {
                $next = $stream.ReadByte()
                if ($next -lt 0) { throw '요청이 중단되었습니다.' }
                $buffer.Add([byte]$next)
                $count = $buffer.Count
                if ($count -gt 16384) { throw '요청 헤더가 너무 큽니다.' }
                if ($count -ge 4 -and $buffer[$count-4] -eq 13 -and $buffer[$count-3] -eq 10 -and $buffer[$count-2] -eq 13 -and $buffer[$count-1] -eq 10) { break }
            }
            $lines = [Text.Encoding]::ASCII.GetString($buffer.ToArray()).Split(@("`r`n"), [StringSplitOptions]::None)
            $parts = $lines[0].Split(' ')
            $method = $parts[0]; $route = $parts[1]
            $headers = @{}
            foreach ($line in $lines[1..($lines.Length-1)]) {
                $colon = $line.IndexOf(':')
                if ($colon -gt 0) { $headers[$line.Substring(0,$colon).ToLowerInvariant()] = $line.Substring($colon+1).Trim() }
            }
            if ($headers['host'] -ne "127.0.0.1:$Port" -or ($headers.ContainsKey('origin') -and $headers['origin'] -ne $baseUrl)) {
                Send-Json $stream @{ error = '접근이 거부되었습니다.' } 403; continue
            }
            if ($method -eq 'GET' -and $route -eq '/favicon.ico') {
                Send-Response $stream 204 ([byte[]]@()) 'image/x-icon'; continue
            }
            if ($method -eq 'GET' -and $route -eq '/') {
                $html = [IO.File]::ReadAllText($htmlFile, $utf8)
                $injection = '<script>window.moaLocal={token:"' + $token + '"};</script>'
                $headPosition = $html.IndexOf('<head>')
                if ($headPosition -lt 0) { throw 'HTML 문서의 시작 부분을 찾지 못했습니다.' }
                $html = $html.Insert($headPosition + 6, $injection)
                Send-Response $stream 200 ($utf8.GetBytes($html)) 'text/html; charset=utf-8' @{'Content-Security-Policy'="default-src 'self' blob: data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; object-src 'none'"}
                continue
            }
            if ($method -ne 'POST' -or $headers['x-moa-token'] -cne $token -or $headers['content-type'] -notlike 'application/json*') {
                Send-Json $stream @{ error = '등록된 모아 화면에서만 요청할 수 있습니다.' } 403; continue
            }
            $length = 0
            if (-not [int]::TryParse($headers['content-length'], [ref]$length) -or $length -lt 0 -or $length -gt 1048576 -or $headers.ContainsKey('transfer-encoding')) { throw '잘못된 요청 크기입니다.' }
            $stream.ReadTimeout = 15000
            $bodyBytes = New-Object byte[] $length
            $offset = 0
            while ($offset -lt $length) {
                $read = $stream.Read($bodyBytes, $offset, $length - $offset)
                if ($read -le 0) { throw '요청 본문이 중단되었습니다.' }
                $offset += $read
            }
            $body = $utf8.GetString($bodyBytes) | ConvertFrom-Json
            switch ($route) {
                '/api/status' {
                    Send-Json $stream @{ version = '0.3.1'; folderCount = $script:roots.Count; apartment = [Threading.Thread]::CurrentThread.GetApartmentState().ToString() }
                }
                '/api/pick' {
                    $files = @(foreach ($path in @(Select-NativeFiles)) { Register-Document $path })
                    Save-Links
                    Send-Json $stream @{ files = $files }
                }
                '/api/folder' {
                    $folder = Select-NativeFolder
                    if ($folder -and $script:roots -notcontains $folder) { $script:roots += $folder; Save-Links }
                    Send-Json $stream @{ path = $folder }
                }
                '/api/resolve' {
                    if (-not $script:roots.Count) { throw '먼저 도구모음의 연결 폴더에서 드래그할 파일이 있는 폴더를 지정해 주세요.' }
                    $paths = @()
                    foreach ($metadata in @($body.files)) {
                        $matches = @(Find-DroppedFile $metadata)
                        if ($matches.Count -eq 0) { throw "원본을 찾지 못했습니다: $($metadata.name). 연결 폴더를 추가하거나 파일 연결 버튼으로 원본을 선택해 주세요." }
                        if ($matches.Count -gt 1) { throw "동일한 파일 후보가 여러 개입니다: $($metadata.name). 파일 연결 버튼으로 정확한 원본을 선택해 주세요." }
                        $paths += $matches[0]
                    }
                    $files = @(foreach ($path in $paths) { Register-Document $path })
                    Save-Links
                    Send-Json $stream @{ files = $files }
                }
                '/api/open' {
                    $item = Resolve-Document ([string]$body.id)
                    # Literal path handed to Windows ShellExecute; never build a command string.
                    $info = New-Object System.Diagnostics.ProcessStartInfo
                    $info.FileName = $item.FullName
                    $info.UseShellExecute = $true
                    [void][Diagnostics.Process]::Start($info)
                    Send-Json $stream @{ opened = $true }
                }
                '/api/read' {
                    $item = Resolve-Document ([string]$body.id)
                    if ($item.Length -gt 83886080) { throw '80MB를 넘는 파일은 미리보기 대신 원본 프로그램으로 열어 주세요.' }
                    $modified = [long]($item.LastWriteTimeUtc - [datetime]'1970-01-01').TotalMilliseconds
                    Send-Response $stream 200 ([IO.File]::ReadAllBytes($item.FullName)) 'application/octet-stream' @{'X-Moa-Name'=[Uri]::EscapeDataString($item.Name); 'X-Moa-Modified'=$modified}
                }
                default { Send-Json $stream @{ error = '지원하지 않는 요청입니다.' } 404 }
            }
        } catch {
            if ($route -like '/api/*') { Write-Host ('연결 요청 오류: ' + $_.Exception.Message) }
            try { Send-Json $stream @{ error = $_.Exception.Message } 400 } catch {}
        } finally { $stream.Dispose(); $client.Close() }
    }
} finally { $listener.Stop() }

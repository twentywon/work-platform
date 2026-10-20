# Isolated STA worker: a dialog or Office conversion cannot block the HTTP helper.
param([ValidateSet('select','preview')][string]$Kind, [string]$ResultBase64, [string]$SourceBase64 = '')
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$directory = $utf8.GetString([Convert]::FromBase64String($ResultBase64))
$source = if ($SourceBase64) { $utf8.GetString([Convert]::FromBase64String($SourceBase64)) } else { '' }
[void][IO.Directory]::CreateDirectory($directory)
$result = $null
$settings = @{}
$app = $null; $document = $null; $owner = $null; $dialog = $null
try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Windows PC에서 실행해야 하는 기능입니다.' }
    if ($Kind -eq 'select') {
        Add-Type -AssemblyName System.Windows.Forms
        $owner = New-Object System.Windows.Forms.Form
        $owner.Text = '코션 원본 파일 선택'
        $owner.Size = New-Object System.Drawing.Size(1,1)
        $owner.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
        $owner.ShowInTaskbar = $false; $owner.TopMost = $true; $owner.Opacity = 0
        $owner.Show(); $owner.Activate(); $owner.BringToFront()
        $dialog = New-Object System.Windows.Forms.OpenFileDialog
        $dialog.Title = '코션 - 바로가기로 연결할 원본 파일 선택 (폴더 지정 불필요)'
        $dialog.Multiselect = $true; $dialog.RestoreDirectory = $true
        $dialog.Filter = '업무 문서 및 이미지|*.hwp;*.hwpx;*.doc;*.docx;*.xls;*.xlsx;*.ppt;*.pptx;*.pdf;*.png;*.jpg;*.jpeg;*.gif;*.webp;*.bmp;*.svg;*.txt;*.md;*.csv;*.json;*.log;*.odt;*.ods;*.odp'
        $files = @()
        if ($dialog.ShowDialog($owner) -eq [Windows.Forms.DialogResult]::OK) { $files = @($dialog.FileNames) }
        $result = @{ ok = $true; paths = $files }
    } else {
        $extension = [IO.Path]::GetExtension($source).ToLowerInvariant()
        $pdf = Join-Path $directory 'page.pdf'; $png = Join-Path $directory 'page.png'
        if ($extension -in @('.doc','.docx')) {
            $app = New-Object -ComObject Word.Application
            $settings['AutomationSecurity'] = $app.AutomationSecurity; $settings['DisplayAlerts'] = $app.DisplayAlerts; $settings['Visible'] = $app.Visible
            $app.Visible = $false; $app.DisplayAlerts = 0; $app.AutomationSecurity = 3
            $document = $app.Documents.Open($source, $false, $true, $false)
            # wdExportFormatPDF=17, wdExportFromTo=3; export page 1 only.
            $document.ExportAsFixedFormat($pdf,17,$false,0,3,1,1)
            $result = @{ ok = $true; format = 'pdf'; source = 'Word 첫 페이지' }
        } elseif ($extension -in @('.xls','.xlsx')) {
            $app = New-Object -ComObject Excel.Application
            $settings['AutomationSecurity'] = $app.AutomationSecurity; $settings['DisplayAlerts'] = $app.DisplayAlerts; $settings['Visible'] = $app.Visible; $settings['EnableEvents'] = $app.EnableEvents; $settings['AskToUpdateLinks'] = $app.AskToUpdateLinks
            $app.Visible = $false; $app.DisplayAlerts = $false; $app.EnableEvents = $false
            $app.AskToUpdateLinks = $false; $app.AutomationSecurity = 3
            $document = $app.Workbooks.Open($source,0,$true)
            $sheet = $document.Worksheets.Item(1)
            try { $sheet.ExportAsFixedFormat(0,$pdf,0,$true,$false,1,1,$false) }
            finally { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($sheet) }
            $result = @{ ok = $true; format = 'pdf'; source = 'Excel 첫 시트의 첫 인쇄 페이지' }
        } elseif ($extension -in @('.ppt','.pptx')) {
            $app = New-Object -ComObject PowerPoint.Application
            $settings['AutomationSecurity'] = $app.AutomationSecurity; $settings['DisplayAlerts'] = $app.DisplayAlerts
            $app.AutomationSecurity = 3; $app.DisplayAlerts = 1
            $document = $app.Presentations.Open($source,-1,0,0)
            $slide = $document.Slides.Item(1)
            try {
                $height = [int][Math]::Round(1200 * $document.PageSetup.SlideHeight / $document.PageSetup.SlideWidth)
                $slide.Export($png,'PNG',1200,$height)
            } finally { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($slide) }
            $result = @{ ok = $true; format = 'png'; source = 'PowerPoint 첫 슬라이드' }
        } else {
            # Ask the installed Windows document thumbnail provider, never an icon.
            Add-Type -AssemblyName System.Drawing
            Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;
public static class MoaThumbnail {
  [StructLayout(LayoutKind.Sequential)] struct Size { public int X; public int Y; }
  [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface ImageFactory { void GetImage(Size size, uint flags, out IntPtr bitmap); }
  [DllImport("shell32.dll", CharSet=CharSet.Unicode, PreserveSig=false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr context, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out ImageFactory factory);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr handle);
  public static void Save(string source, string output) {
    var iid=new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"); ImageFactory factory; IntPtr bitmap=IntPtr.Zero;
    SHCreateItemFromParsingName(source,IntPtr.Zero,ref iid,out factory);
    try { factory.GetImage(new Size {X=1200,Y=1200},9,out bitmap); using(var image=Image.FromHbitmap(bitmap)) image.Save(output,ImageFormat.Png); }
    finally { if(bitmap!=IntPtr.Zero) DeleteObject(bitmap); Marshal.ReleaseComObject(factory); }
  }
}
'@ -ReferencedAssemblies System.Drawing
            [MoaThumbnail]::Save($source,$png)
            $result = @{ ok = $true; format = 'png'; source = 'Windows 문서 미리보기 제공자' }
        }
        if (-not (Test-Path -LiteralPath (Join-Path $directory ('page.'+$result.format)))) { throw '첫 페이지 이미지 파일을 생성하지 못했습니다.' }
    }
} catch { $result = @{ ok = $false; error = $_.Exception.Message } }
finally {
    if ($document) {
        try {
            if ($extension -in @('.doc','.docx')) { $document.Close(0) }
            elseif ($extension -in @('.xls','.xlsx')) { $document.Close($false) }
            else { $document.Close() }
        } catch {}
        try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document) } catch {}
    }
    if ($app) {
        # Do not close other documents if Office reused a running application.
        try {
            $count = if ($extension -in @('.doc','.docx')) { $app.Documents.Count } elseif ($extension -in @('.xls','.xlsx')) { $app.Workbooks.Count } else { $app.Presentations.Count }
            if ($count -eq 0) { $app.Quit() }
            else {
                foreach ($key in $settings.Keys) { try { $app.$key = $settings[$key] } catch {} }
            }
        } catch {}
        try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app) } catch {}
    }
    if ($dialog) { $dialog.Dispose() }
    if ($owner) { $owner.Close(); $owner.Dispose() }
    $json = $result | ConvertTo-Json -Depth 6 -Compress
    [IO.File]::WriteAllText((Join-Path $directory 'result.tmp'),$json,$utf8)
    Move-Item -LiteralPath (Join-Path $directory 'result.tmp') -Destination (Join-Path $directory 'result.json') -Force
}

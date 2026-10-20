# Configure the UI thread before creating any WinForms or WebView2 window handles.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class MoaDisplay {
    [DllImport("shell32.dll", CharSet=CharSet.Unicode, ExactSpelling=true)]
    static extern int SetCurrentProcessExplicitAppUserModelID(string appId);
    public static bool SetIdentity() {
        try { return SetCurrentProcessExplicitAppUserModelID("Cotion.Workspace")==0; }
        catch (EntryPointNotFoundException) { return false; }
        catch (DllNotFoundException) { return false; }
    }
    [DllImport("user32.dll", SetLastError=true)]
    static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll", SetLastError=true)]
    static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("shcore.dll")]
    static extern int SetProcessDpiAwareness(int awareness);
    [DllImport("user32.dll")]
    static extern bool SetProcessDPIAware();
    public static string Enable() {
        bool process=false, thread=false;
        try { process=SetProcessDpiAwarenessContext(new IntPtr(-4)); }
        catch (EntryPointNotFoundException) {} catch (DllNotFoundException) {}
        // PowerShell may already have a process-level setting. Set the actual UI thread too.
        try { thread=SetThreadDpiAwarenessContext(new IntPtr(-4))!=IntPtr.Zero; }
        catch (EntryPointNotFoundException) {} catch (DllNotFoundException) {}
        if (process || thread) return "PerMonitorV2";
        try { if (SetProcessDpiAwareness(2)==0) return "PerMonitor"; }
        catch (EntryPointNotFoundException) {} catch (DllNotFoundException) {}
        try { if (SetProcessDPIAware()) return "System"; }
        catch (EntryPointNotFoundException) {} catch (DllNotFoundException) {}
        return "Existing";
    }
}
'@

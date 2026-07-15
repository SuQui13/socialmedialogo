$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Social Photo Exporter.lnk"
$launcher = Join-Path $root "START-APP.cmd"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = $root
$shortcut.Description = "Offline Social Photo Exporter"
$shortcut.IconLocation = "$env:SystemRoot\System32\imageres.dll,67"
$shortcut.WindowStyle = 7
$shortcut.Save()

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show("Social Photo Exporter was added to your Desktop.", "Microapp installed") | Out-Null

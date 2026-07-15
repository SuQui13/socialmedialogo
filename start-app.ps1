$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "http://127.0.0.1:8765/"
$ready = $false

function Find-AppBrowser {
  $candidates = @()
  if (${env:ProgramFiles(x86)}) {
    $candidates += Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"
    $candidates += Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"
  }
  if ($env:ProgramFiles) {
    $candidates += Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"
    $candidates += Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"
  }
  if ($env:LOCALAPPDATA) {
    $candidates += Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"
  }

  return $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

try {
  $status = Invoke-RestMethod -Uri "${url}api/status" -TimeoutSec 1
  $ready = $status.ready -eq $true
} catch {
  $ready = $false
}

if (-not $ready) {
  Start-Process -FilePath "node" -ArgumentList "server.mjs" -WorkingDirectory $root -WindowStyle Hidden
  for ($attempt = 0; $attempt -lt 20 -and -not $ready; $attempt++) {
    Start-Sleep -Milliseconds 250
    try {
      $status = Invoke-RestMethod -Uri "${url}api/status" -TimeoutSec 1
      $ready = $status.ready -eq $true
    } catch {
      $ready = $false
    }
  }
}

if ($ready) {
  $browser = Find-AppBrowser
  if ($browser) {
    Start-Process -FilePath $browser -ArgumentList @("--app=$url", "--start-maximized")
  } else {
    Start-Process $url
  }
} else {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show("The local app could not start. Make sure Node.js is installed.", "Social Photo Exporter") | Out-Null
}

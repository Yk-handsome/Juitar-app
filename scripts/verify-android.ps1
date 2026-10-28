param(
  [string]$Serial = "",
  [string]$Apk = ""
)
$ErrorActionPreference = 'Stop'
$adb = Get-ChildItem -Path "$env:LOCALAPPDATA\Android\Sdk" -Filter adb.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if ([string]::IsNullOrWhiteSpace($adb)) { throw 'ADB_NOT_FOUND' }
if ([string]::IsNullOrWhiteSpace($Apk)) { $Apk = "release-apk/Juitar-v0.2.0-arm64.apk" }
if (!(Test-Path $Apk)) { throw "APK_NOT_FOUND: $Apk" }
$target = if ($Serial) { @('-s', $Serial) } else { @() }
$devices = & $adb @target devices
if ($LASTEXITCODE -ne 0) { throw 'ADB_DEVICES_FAILED' }
$deviceLine = $devices | Where-Object { $_ -match '\bdevice$' } | Select-Object -First 1
if (!$deviceLine) { throw 'NO_ONLINE_ANDROID_DEVICE' }
& $adb @target install -r $Apk | Out-Host
& $adb @target logcat -c
& $adb @target shell am force-stop com.juitar.app
& $adb @target shell monkey -p com.juitar.app 1 | Out-Host
Start-Sleep -Seconds 4
$version = & $adb @target shell dumpsys package com.juitar.app | Select-String -Pattern 'versionCode=|versionName='
$logs = & $adb @target logcat -d -s JuitarWeb '*:S'
if ($logs -match 'FileNotFoundException.*worker|FileNotFoundException.*pdf.worker|onReceivedError|谱面错误') {
  $logs | Out-Host
  throw 'ANDROID_RUNTIME_ASSET_ERROR'
}
if ($logs -notmatch 'page=https://appassets.androidplatform.net/assets/dist/index.html') {
  $logs | Out-Host
  throw 'ANDROID_PAGE_NOT_CONFIRMED'
}
Write-Output 'Android smoke verification passed'
$version | Out-Host
$logs | Select-Object -Last 20 | Out-Host


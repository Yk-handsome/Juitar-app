param(
  [string]$Serial = "",
  [string]$Apk = "",
  [string]$Screenshot = "docs/screenshots/android-smoke.png"
)
$ErrorActionPreference = 'Stop'
$adb = Get-ChildItem -Path "$env:LOCALAPPDATA\Android\Sdk" -Filter adb.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if ([string]::IsNullOrWhiteSpace($adb)) { throw 'ADB_NOT_FOUND' }
if ([string]::IsNullOrWhiteSpace($Apk)) { $Apk = "release-apk/Juitar-v0.2.1-arm64.apk" }
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
$logsText = $logs -join [Environment]::NewLine
if ($logsText -match 'FileNotFoundException.*worker|FileNotFoundException.*pdf.worker|onReceivedError|谱面错误') {
  $logs | Out-Host
  throw 'ANDROID_RUNTIME_ASSET_ERROR'
}
$focus = (& $adb @target shell dumpsys window) -join [Environment]::NewLine
if (!$focus.Contains('com.juitar.app/.MainActivity')) { throw 'ANDROID_ACTIVITY_NOT_ACTIVE' }
$view = (& $adb @target shell cmd package query-activities --brief -a android.intent.action.VIEW -c android.intent.category.DEFAULT -t image/png) -join [Environment]::NewLine
if ($view -notmatch 'com\.juitar\.app/\.MainActivity') { throw 'ANDROID_VIEW_INTENT_NOT_REGISTERED' }
$send = (& $adb @target shell cmd package query-activities --brief -a android.intent.action.SEND_MULTIPLE -c android.intent.category.DEFAULT -t image/png) -join [Environment]::NewLine
if ($send -notmatch 'com\.juitar\.app/\.MainActivity') { throw 'ANDROID_SEND_MULTIPLE_INTENT_NOT_REGISTERED' }
Write-Output 'Android smoke verification passed'
$view | Select-String 'com.juitar.app/.MainActivity' | Out-Host
$send | Select-String 'com.juitar.app/.MainActivity' | Out-Host
$version | Out-Host
$logs | Select-Object -Last 20 | Out-Host
New-Item -ItemType Directory -Force (Split-Path $Screenshot -Parent) | Out-Null
& $adb @target exec-out screencap -p > $Screenshot
Write-Output "Screenshot: $Screenshot"



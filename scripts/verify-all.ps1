$ErrorActionPreference = 'Stop'
npm run test
if ($LASTEXITCODE -ne 0) { throw 'TEST_FAILED' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'BUILD_FAILED' }
$sdkRoot = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
$env:ANDROID_SDK_ROOT = $sdkRoot
powershell -ExecutionPolicy Bypass -File android-lite/build.ps1
if ($LASTEXITCODE -ne 0) { throw 'APK_BUILD_FAILED' }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw 'RELEASE_ASSET_CHECK_FAILED' }
npm run verify:android
if ($LASTEXITCODE -ne 0) { throw 'ANDROID_SMOKE_FAILED' }
Write-Output 'Juitar full verification passed'

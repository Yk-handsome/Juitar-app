# Android WebView package

This folder contains the no-NDK Android wrapper used for the offline APK artifact. It embeds the Vite build in a local asset origin and keeps the same responsive workspace used by the desktop and browser builds.

Build from the repository root:

```powershell
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
./android-lite/build.ps1
```

The produced APK is written to `release-apk/Juitar-v0.0.10-arm64.apk`. It is a Java/WebView package without native ABI payloads, so it installs on the ARM64 target phones and the x86_64 emulator.

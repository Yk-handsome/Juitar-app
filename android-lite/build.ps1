param(
  [string]$SdkRoot = $env:ANDROID_SDK_ROOT,
  [string]$Output = "release-apk/Juitar-v0.2.0-arm64.apk"
)
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($SdkRoot)) { throw 'ANDROID_SDK_ROOT is required' }
$bt = Join-Path $SdkRoot 'build-tools/36.0.0'
$platform = Join-Path $SdkRoot 'platforms/android-37.0'
$root = Split-Path -Parent $PSScriptRoot
$build = Join-Path $PSScriptRoot 'build'
New-Item -ItemType Directory -Force (Join-Path $build 'compiled'),(Join-Path $build 'gen'),(Join-Path $build 'classes'),(Join-Path $build 'dex'),(Join-Path $build 'package') | Out-Null
$env:VITE_BASE = './'
Push-Location $root
npm run build
Pop-Location
Remove-Item Env:VITE_BASE -ErrorAction SilentlyContinue
& (Join-Path $bt 'aapt2.exe') compile --dir (Join-Path $PSScriptRoot 'res') -o (Join-Path $build 'compiled/res.zip')
& (Join-Path $bt 'aapt2.exe') link -I (Join-Path $platform 'android.jar') -R (Join-Path $build 'compiled/res.zip') --auto-add-overlay --manifest (Join-Path $PSScriptRoot 'AndroidManifest.xml') -o (Join-Path $build 'linked.apk') --java (Join-Path $build 'gen')
javac -source 8 -target 8 -classpath (Join-Path $platform 'android.jar') -d (Join-Path $build 'classes') (Join-Path $PSScriptRoot 'src/com/juitar/app/MainActivity.java')
& (Join-Path $bt 'd8.bat') --lib (Join-Path $platform 'android.jar') --output (Join-Path $build 'dex') (Join-Path $build 'classes/com/juitar/app/*.class')
Copy-Item (Join-Path $build 'dex/classes.dex') (Join-Path $build 'package/classes.dex') -Force
@'
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED
import shutil
root = Path(r'''ROOT_PATH''')
build = Path(r'''BUILD_PATH''')
pkg = build / 'package'
with ZipFile(build / 'linked.apk') as z:
    for name in ('AndroidManifest.xml', 'resources.arsc'):
        (pkg / name).write_bytes(z.read(name))
assets = pkg / 'assets' / 'dist'
if assets.exists(): shutil.rmtree(assets)
shutil.copytree(root / 'dist', assets)
with ZipFile(build / 'base.apk', 'w') as z:
    for p in pkg.rglob('*'):
        if p.is_file():
            rel = p.relative_to(pkg).as_posix()
            mode = ZIP_STORED if rel in ('AndroidManifest.xml', 'resources.arsc', 'classes.dex') else ZIP_DEFLATED
            z.write(p, rel, compress_type=mode)
'@.Replace('ROOT_PATH', $root).Replace('BUILD_PATH', $build) | python -
& (Join-Path $bt 'zipalign.exe') -f -p 4 (Join-Path $build 'base.apk') (Join-Path $build 'aligned.apk')
$keystore = if ($env:JUITAR_KEYSTORE) { $env:JUITAR_KEYSTORE } else { Join-Path $PSScriptRoot 'keystore/juitar-release.keystore' }
$storepass = if ($env:JUITAR_KEYSTORE_PASSWORD) { $env:JUITAR_KEYSTORE_PASSWORD } else { 'juitar-local-release' }
$keypass = if ($env:JUITAR_KEY_PASSWORD) { $env:JUITAR_KEY_PASSWORD } else { $storepass }
$alias = if ($env:JUITAR_KEY_ALIAS) { $env:JUITAR_KEY_ALIAS } else { 'juitar-release' }
$keytool = (Get-Command keytool -ErrorAction SilentlyContinue).Source
if ([string]::IsNullOrWhiteSpace($keytool) -and $env:JAVA_HOME) { $keytool = Join-Path $env:JAVA_HOME 'bin/keytool.exe' }
if ([string]::IsNullOrWhiteSpace($keytool)) { $keytool = 'F:/compiler_tools/java/java_version_21/bin/keytool.exe' }
New-Item -ItemType Directory -Force (Split-Path $keystore -Parent) | Out-Null
if (!(Test-Path $keystore)) { & $keytool -genkeypair -keystore $keystore -storepass $storepass -keypass $keypass -alias $alias -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Juitar Release,O=Juitar,C=CN' | Out-Null }
New-Item -ItemType Directory -Force (Join-Path $root (Split-Path $Output -Parent)) | Out-Null
& (Join-Path $bt 'apksigner.bat') sign --ks $keystore --ks-pass ('pass:' + $storepass) --key-pass ('pass:' + $keypass) --ks-key-alias $alias --out (Join-Path $root $Output) (Join-Path $build 'aligned.apk')
& (Join-Path $bt 'apksigner.bat') verify --verbose (Join-Path $root $Output)


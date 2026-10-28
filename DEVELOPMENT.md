# Juitar 开发环境与完整开发流程

这是 Juitar 的开发主文档。README 只负责入口导航；环境安装、日常开发、手机调试、APK 构建和发布流程都以本文为准。

## 1. 项目结构

当前运行时采用原生单页结构：

~~~text
index.html
├── src/app.js       原生 DOM、曲目/谱页模型、alphaTab、导入、谱夹、笔记抽屉和播放
└── src/style.css    全屏看谱布局、悬浮控件和抽屉样式
~~~

核心视图：

- 看谱：全宽连续显示当前曲目的多张图片谱、PDF 或 alphaTab 真谱页。
- 笔记：默认隐藏的当前曲目底部抽屉，自动保存文本；阅读页码和滚动位置由 APP 自动记忆。
- Android：android-lite/MainActivity.java 提供 WebView、资源拦截和系统文件选择器。

参考项目位于 `F:/Code_listary/Juitar/reference project`：

- `tuxguitar`：Java/Android 吉他谱编辑器和播放器，参考曲库抽屉、文件浏览、谱面滚动与播放入口的交互方式。
- `vexflow`：浏览器 SVG/Canvas 五线谱渲染器，参考其固定版本、渲染器和可测试 HTML 示例组织方式；Juitar 当前 GP/MusicXML 主渲染仍使用本地 alphaTab。
- `NoteLite`：Java 谱面/图像处理项目，参考导入文件、谱面缩放和离线数据处理思路；它不是 Juitar 的运行时依赖。

## 2. 开发环境

### Windows

- Windows 10/11
- PowerShell 7 或 Windows PowerShell
- 仓库目录：F:/Code_listary/Juitar/Juitar-app

### Web 工具链

| 工具 | 要求 | 用途 |
|---|---|---|
| Node.js | 推荐 Node 20+；当前验证 Node 24.21.0 | Vite、测试和脚本 |
| npm | 当前验证 npm 11.19.0 | 依赖管理 |
| Vite | 8.x | 开发服务器和生产构建 |
| TypeScript | 6.x | 类型检查 |
| Vitest | 4.x | 单元测试 |
| alphaTab | 1.8.x | GP、MusicXML、AlphaTex 真谱渲染 |

### 桌面 Tauri

- Rust stable
- Cargo
- Tauri CLI 2.x
- Windows MSVC linker 和 Windows SDK

检查：

~~~powershell
rustc --version
cargo --version
npm run tauri -- --version
~~~

### Android

当前验证环境：

- ANDROID_SDK_ROOT=C:/Users/Yk/AppData/Local/Android/Sdk
- Android platform：android-37.0
- Build Tools：36.0.0
- Platform-Tools：adb.exe
- AVD：Medium_Phone_API_37.0
- Java 17/21：javac、keytool

检查：

~~~powershell
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA/Android/Sdk"
adb version
emulator -list-avds
java -version
javac -version
~~~

## 3. 首次安装

~~~powershell
git clone https://github.com/Yk-handsome/Juitar-app.git
Set-Location F:/Code_listary/Juitar/Juitar-app
npm install
~~~

网络中断时重试：

~~~powershell
npm install --no-audit --no-fund
~~~

不要删除 package-lock.json。

## 4. 本地开发

启动 Vite：

~~~powershell
npm run dev -- --host 127.0.0.1
~~~

访问：

~~~text
http://127.0.0.1:5173/
~~~

当前入口：

- index.html：页面骨架和脚本引用。
- src/app.js：唯一运行时入口。
- src/style.css：布局和视觉。
- public/alphatab/：alphaTab 主包、worker 和 worklet。
- vite.config.ts：把 src/app.js 复制到 dist/src/app.js。

### 直接双击 HTML

file:// 模式会受到浏览器安全策略限制，alphaTab worker 不能可靠运行。现在直接双击 HTML 不会再是纯空白，而是显示说明卡片。查看真实六线谱请运行 npm run dev 或使用 APK。

## 5. 导入谱页

点击顶部“＋ 添加谱页”。

| 类型 | 扩展名 | 行为 |
|---|---|---|
| 图片谱 | .png、.jpg、.jpeg | 全宽显示、滚动和缩放 |
| PDF 谱 | .pdf | 本地 PDF.js 多页 canvas |
| Guitar Pro | .gp3、.gp4、.gp5、.gpx | alphaTab 真谱 |
| MusicXML | .xml、.musicxml | alphaTab 真谱 |

图片谱不能自动得到小节结构；需要播放、调速和阅读位置时使用 GP 或 MusicXML。

Android 文件选择器由 MainActivity.java 的 onShowFileChooser 提供：

~~~powershell
adb logcat -s JuitarWeb
~~~

## 6. alphaTab 真谱验收

默认 AlphaTex：

~~~text
\title 'Californian Evening'
\tempo 90
. 0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |
~~~

验收信号：

- 顶部状态显示“真实六线谱已渲染”。
- scoreHost 内存在 alphaTab SVG。
- 画面中出现六条横线、TAB 标记和品格数字。
- 不允许用数字矩阵、手绘横线或占位谱面代替 alphaTab。

## 7. 谱夹、笔记和播放

1. 点击右上角“＋ 添加谱页”，选择图片、PDF、GP3/GP4/GP5、GPX 或 MusicXML。
2. 图片和 PDF 直接全宽展示；GP/MusicXML 通过 alphaTab 渲染真实六线谱。
3. 点击谱夹里的“＋ 新建曲子”，输入曲名即可创建一份内置 AlphaTex 六线谱模板；创建后立即打开并保存到谱夹。
4. 导入的文件会写入 IndexedDB，文件名称和类型同步保存在 localStorage 的谱夹列表中。
5. 点击右下角 📝 打开当前曲目的底部笔记抽屉，输入内容后自动保存。
6. 点击右下角 📝 打开当前曲目的底部笔记抽屉，输入内容后自动保存。阅读位置由 APP 自动记忆。
7. 只有 AlphaTex、GP 和 MusicXML 显示播放/BPM 悬浮药丸；图片和 PDF 不显示播放控件。

## 8. 测试和构建

单元测试：

~~~powershell
npm run test
~~~

生产构建：

~~~powershell
npm run build
~~~

桌面构建：

~~~powershell
npm run tauri:build
~~~

Android APK：

~~~powershell
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA/Android/Sdk"
powershell -ExecutionPolicy Bypass -File android-lite/build.ps1
~~~

产物：

~~~text
release-apk/Juitar-v0.2.1-arm64.apk
~~~

签名验证：

~~~powershell
$bt = "$env:ANDROID_SDK_ROOT/build-tools/36.0.0"
& "$bt/apksigner.bat" verify --verbose release-apk/Juitar-v0.2.1-arm64.apk
~~~

## 9. 手机调试

连接手机并打开 USB 调试：

~~~powershell
adb devices -l
~~~

安装和启动：

~~~powershell
adb install -r release-apk/Juitar-v0.2.1-arm64.apk
adb shell am force-stop com.juitar.app
adb shell monkey -p com.juitar.app 1
~~~

截图和日志：

~~~powershell
adb exec-out screencap -p > docs/screenshots/phone-debug/current.png
adb logcat -s JuitarWeb
~~~

实机证据：

- docs/screenshots/phone-debug/after-fix.png：真实六线谱。
- docs/screenshots/phone-debug/file-picker-fixed.png：系统文件选择器。
- docs/screenshots/phone-debug/image-imported.png：图片谱导入结果。
- docs/screenshots/phone-debug/direct-file3.png：直接 HTML 打开的说明界面。

## 10. 视觉验收

每次 UI 修改后检查：

1. 393×873 竖屏：40px 顶栏、谱面全宽、没有左右分屏或打卡模块。
2. 笔记抽屉默认隐藏，打开后占底部约 35%，关闭后恢复全屏看谱。
3. alphaTab 显示六条谱线和品格数字，并触发 `renderFinished`。
4. 图片、PDF、GP5、MusicXML 至少各验证一次；图片/PDF 不显示播放药丸。

完整截图和验收手册见 PRODUCT_SHOWCASE.md。

## 11. Git 版本流程

~~~powershell
git status
git add <files>
git commit -m "fix: describe the change"
git tag -a v0.0.x -m "Juitar v0.0.x"
git push origin main
git push origin v0.0.x
~~~

当前版本：

- v0.0.1：响应式工作台基线
- v0.0.4：Android asset 路径准备
- v0.0.5：Android WebView 包和模拟器证据
- v0.0.6：最终 APK 和交付文档
- v0.0.7：原生单页、真实 AlphaTex 六线谱
- v0.0.8：Android 文件选择器、手机缩放和直接 HTML 兜底
- v0.2.1：极简全屏谱夹、IndexedDB 导入、底部笔记抽屉和悬浮播放器

## 12. 常见问题

### 页面空白

不要双击 HTML 验收 alphaTab。运行 npm run dev 或使用 APK。

### 导入按钮无反应

确认安装 v0.2.1 APK。Android 原生桥接必须包含 onShowFileChooser。

### 真谱没有出现

检查 public/alphatab/alphaTab.min.js、worker、public/font/ 和 new URL 生成的资源路径，确认状态变成“真实六线谱已渲染”。

### 手机文字挤压

确认运行的是原生单页入口，不是旧 Vue 分屏构建；重新执行 npm run build 或重新安装 APK。


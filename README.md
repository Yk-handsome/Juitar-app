# Juitar

Juitar 是一个本地优先的吉他谱查看、练习和笔记工具。

## 快速开始

~~~powershell
npm install
npm run dev -- --host 127.0.0.1
~~~

然后打开 `http://127.0.0.1:5173/`。

## 当前入口

- `index.html`：单页 HTML 入口
- `src/app.js`：原生 JavaScript、alphaTab、导入、笔记和练习控制
- `src/style.css`：移动端全宽布局和桌面布局
- `android-lite/`：Android WebView 包装与 APK 构建脚本

## 开发文档

完整开发环境、目录职责、浏览器开发、alphaTab 真谱验收、手机 ADB 调试、APK 构建、测试和版本发布流程，请阅读：

**[DEVELOPMENT.md](DEVELOPMENT.md)**

产品截图、实战验收和版本记录请阅读：

**[PRODUCT_SHOWCASE.md](PRODUCT_SHOWCASE.md)**

## 常用命令

~~~powershell
npm run test
npm run build
npm run tauri:build
~~~

Android APK 构建：

~~~powershell
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA/Android/Sdk"
powershell -ExecutionPolicy Bypass -File android-lite/build.ps1
~~~

# Juitar 产品视觉与功能验收手册

> 当前基线：`v0.0.6` · Vue 3 + TypeScript + Tauri + Rust + alphaTab

## 1. 产品设计美学

Juitar 的工作台采用深色音乐工作室风格：底层使用 `#0D0E11`，面板使用 `#14161B` 与 `#191C22`，边界只保留低对比度 1px 高光；暖琥珀色用于播放、选中和练习焦点。数字区域使用等宽数字，速度、小节和练习状态不会因位数变化而跳动。

交互优先考虑练琴姿势：桌面端保持谱面与笔记同屏，移动端将谱面和笔记切换为单面工作区，底部固定 Touch Bar 提供播放、回到循环、速度和 A-B 循环入口。短屏横屏通过高度断点切换为移动工作区，兼容 20:9 手机横屏。

## 2. 核心界面图鉴

### 桌面主工作台

![桌面工作台](docs/screenshots/desktop-workbench.png)

顶部是曲目上下文和播放入口；中段为曲库搜索与标签筛选；下方左侧是谱面视窗和小节导航，右侧是 Markdown 练习笔记。

### 小米 14 Pro / 荣耀 70 竖屏

![手机竖屏工作台](docs/screenshots/mobile-portrait.png)

竖屏使用“谱面 / 笔记”双标签，谱面底部保留拇指热区 Touch Bar。谱面工具栏不再强行塞入所有桌面控制，速度和循环集中到下方操作区。

### 20:9 横屏

![手机横屏工作台](docs/screenshots/mobile-landscape.png)

横屏通过短高度断点进入移动布局，避免 873×393 设备继续显示桌面分屏。

### 曲库抽屉与搜索筛选

![移动曲库抽屉](docs/screenshots/mobile-library-drawer.png)

曲库入口展开后显示搜索框、标签筛选和曲目卡片；选中曲目后自动回到谱面工作区。

### 笔记锚点与 A-B 循环

![锚点循环状态](docs/screenshots/desktop-anchor-loop.png)

`[m:8-12]` 被解析为结构化小节锚点，点击后会将当前小节设为 8，并激活 8–12 小节循环。

### 移动笔记面板

![移动笔记面板](docs/screenshots/mobile-notes.png)

移动端笔记单独占满工作区，仍保留自动保存和 Markdown 编辑 / 预览切换。

### Android 模拟器竖屏

![Android 模拟器竖屏](docs/screenshots/android/emulator-portrait.png)

模拟器使用 `Medium_Phone_API_37.0`，通过 `adb install` 安装 APK 后启动 `com.juitar.app`，截图证明同一套 Touch Bar 和谱面工作区在 Android WebView 中可用。横屏布局使用前面的浏览器 873×393 截图验收。

## 3. 实战曲谱测试夹具

`sample-vault/Songs/` 中包含 4 首可直接扫描的 MusicXML 曲谱：

| 曲目 | 风格标签 | 复杂度测试点 |
|---|---|---|
| Hotel California | rock / solo | 基础小节定位、推弦练习笔记 |
| Midnight Drive | rock / alternate-picking | 多轨、交替拨弦、速度训练 |
| Maple Room Etude | fingerstyle / arpeggio | DADGAD、分解和弦、跨小节循环 |
| Neon Skyline Solo | solo / bending | 降半音、推弦、滑音和变速段落 |

每首曲目都包含 `song.json`、`score.musicxml`、`notes.md` 和 `practice-log.md`。笔记均包含 `[m:4]`、`[m:8-12]` 和设备 / 调弦记录。

## 4. 已执行验证

- `npm run test`：3 个测试文件、8 个测试通过。
- `npm run build`：Vue 类型检查与 Vite 生产构建通过。
- 本地浏览器真实渲染截图：桌面 1440×900、竖屏 393×873、横屏 873×393。
- 锚点状态截图：`?showcase=anchor` 进入 8–12 循环状态。
- 曲库状态截图：`?showcase=library` 展开移动曲库抽屉。
- 笔记状态截图：`?showcase=notes` 进入移动笔记面板。
- Android 模拟器：APK 安装成功，启动焦点为 `com.juitar.app/.MainActivity`，竖屏截图已保存。

### 浏览器端到端实战记录

在本地浏览器真实 DOM 上完成了以下操作：进入 Markdown 预览 → 编辑并保存包含 `[m:8-12]` 的练习记录 → 点击锚点胶囊 → 验证当前小节为 8、A-B 为 8–12 → 连续点击调速减号五次，将速度从 100% 调到 75% → 点击“开始练习”，按钮切换为“暂停”。该流程运行期间浏览器控制台错误日志为空；此前 `[m:24-28]` 也完成了同样的联动验证。

## 5. 版本演进

| 版本 | Commit | 摘要 |
|---|---|---|
| v0.0.1 | `d4aab2f` | 统一版本基线；建立深色设计系统；加入响应式工作台、移动 Touch Bar、曲库抽屉和截图验收资产。 |
| v0.0.2 | `933babc` | 增加 70% / 80% / 100% 练习速度预设；锚点验收进入真实 Markdown 预览；补齐多首 MusicXML 实战夹具。 |
| v0.0.3 | `68be082` | 补齐曲面屏安全边距、触控目标和移动端触摸行为。 |
| v0.0.4 | `37b9443` | 让谱面字体、音色和演示曲谱使用 Vite base URL，兼容 Android asset 离线加载。 |
| v0.0.5 | `0fbabfa` | 生成 Android WebView APK；在 `Medium_Phone_API_37.0` 模拟器安装并完成竖屏截图验收。 |
| v0.0.6 | `70426e9` | 固定 Vitest 单 worker 回归配置；完成最终 Android APK 与交付文档。 |

## 6. 交付路径

- 截图：`docs/screenshots/`
- 示例曲库：`sample-vault/`
- 前端入口：[src/App.vue](src/App.vue)
- 视觉样式：[src/style.css](src/style.css)
- 构建记录：[BUILD_LOG.md](BUILD_LOG.md)

Android APK：`release-apk/Juitar-v0.0.6-arm64.apk`。该产物是无原生 ABI 的 Java/WebView 包装，兼容 ARM64 目标手机和 x86_64 Android 模拟器；Tauri 桌面端仍使用同一份 Vue 前端与本地 Vault 逻辑。

# Juitar 构建日志

## 阶段 1：项目脚手架与环境初始化

- 状态：已完成
- 初始化：Vite + Vue 3 + TypeScript
- 依赖：Pinia、Tailwind CSS Vite 插件、alphaTab、Markdown-it、Vitest、Tauri API
- 资源：`public/soundfont/sonivox.sf2`
- 示例曲库：`sample-vault/Songs/Hotel California/`
- 验证：`npm run build` 已通过（首次构建后持续回归）

## 阶段 2：Rust / Tauri 后端

- 状态：实现完成，正在进行桌面构建验证
- Commands：`open_vault`、`scan_songs`、`read_file`、`write_file`、`ensure_directory`
- 配置读写：`read_settings`、`write_settings`
- 错误处理：所有命令返回 `Result<T, String>`，文件和目录错误转为可读消息
- 对话框：Tauri dialog 插件用于选择 Vault

## 阶段 3：前端领域模块

- 状态：已完成
- Stores：`appStore`、`libraryStore`、`scoreStore`
- 组件：`ScoreView`、`NoteEditor`、`TopBar`、`SplitLayout`
- 联动：小节锚点、A-B 循环、播放速度、笔记自动保存、曲库搜索和标签筛选
- 快捷键：空格播放/暂停，`[` / `]` 调速，`R` 重置循环

## 阶段 4：自动化验证

- 锚点测试：已覆盖 `[m:24]`、`[m:24-28]`、时间戳和和弦锚点
- Vault 测试：已覆盖示例曲库生成、扫描、笔记读取
- `npm run test`：已通过（2 个测试文件，6 个测试）
- `npm run build`：已通过（Vue 类型检查和 Vite 生产构建）
- `cargo check`：已通过（串行执行，避免 dist 资源竞争）
- `cargo check`：已通过（MSVC x64 环境）

## 阶段 5：桌面构建

- 状态：已完成
- `npm run tauri:build`：已通过（默认 NSIS 目标）
- 运行产物：`src-tauri/target/release/juitar-app.exe`
- 安装包：`src-tauri/target/release/bundle/nsis/Juitar_0.1.0_x64-setup.exe`
- 运行冒烟：可启动并保持运行 5 秒后正常终止
- 最终回归：`npm run test` 通过（2 个测试文件，6 个测试）；`npm run build` 通过；`cargo check` 通过；`npm run tauri:build` 通过

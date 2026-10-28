# Juitar 产品闭环计划与验收矩阵

## 产品目标

Juitar 是本地优先的移动吉他谱夹。完整用户流程是：

导入曲谱 → 归入曲目 → 连续看谱 → 记录笔记 → 恢复上次位置 → 导出备份 → 换设备恢复。

产品优先级：看谱连续性、数据安全、手机可靠性。

## 当前能力

- 图片多页曲目：已完成，393×873 HTML 已验证。
- PDF 本地渲染：已完成，PDF.js canvas 和 worker 已打包。
- GP、GPX、MusicXML：已完成，alphaTab 真实谱面已验证。
- 曲目重命名、收藏、最近打开：已完成。
- 谱页排序、删除、最近删除恢复：已完成。
- ZIP 导出和恢复：已完成。
- 屏幕常亮、横屏沉浸、横屏翻页：已完成。
- Android 返回键、文件关联、单文件/多文件分享入口：已接入。
- 稳定 release keystore：已完成。

## 三层测试

### HTML 固定视口

每次 UI 修改验证 393×873 和 874×394：

- 默认真实六线谱。
- 多图导入预览。
- 曲目切换。
- 谱页跳转和排序。
- 笔记抽屉。
- 重命名、收藏、最近筛选。
- ZIP 导出和恢复。
- 最近删除恢复。
- PDF.js 本地多页 canvas 渲染。
- Android worker/worklet/PDF worker 资源检查。
- 横屏翻页。

### Android 模拟器

当前 AVD：Medium_Phone_API_37.0。

验证：

- APK 安装和启动。
- alphaTab worker 和 PDF worker。
- Android 返回键。
- ACTION_VIEW 文件入口。
- ACTION_SEND 分享入口。
- 横屏和系统栏。
- 文件选择器。

### Android 真机

验证：

- 覆盖安装。
- 文件管理器打开图片、PDF、GP。
- 分享到 Juitar。
- 屏幕常亮。
- 返回键层级关闭。
- 横屏翻页。
- 大图片和多页 PDF。
- 导入后数据持久化。

## V0.2 数据安全

已完成：

- manifest.json 和 schemaVersion。
- ZIP 格式校验。
- ZIP 导入恢复。
- 曲目和谱页最近删除。
- 稳定 keystore。
- 旧 Blob 数据回退读取。
- Android 版本号和 APK v2/v3 签名。

后续：

- ZIP 同名冲突选择。
- 最近删除自动清理。
- 永久删除二次确认。
- 数据迁移失败回滚。
- 导出前完整性检查。

## V0.3 曲库效率

已完成：

- 最近打开。
- 收藏。
- 搜索。
- 曲目缩略图。
- 谱页缩略图。
- 重复谱页检测。
- 谱页点击跳转。
- 曲目缩略图、谱页缩略图。
- 最近打开曲目卡片。
- 多文件自然排序。
- PDF 首页面缩略图。
- 图片谱底部缩略图条。
- GP/MusicXML 播放自动滚动。
- Android 原生屏幕常亮。

后续：

- 曲目封面替换。
- 作者、调弦、变调夹、默认 BPM。
- 批量导入排序。
- 谱页重命名。
- 空曲目引导页。

## V0.4 阅读体验

后续：
- 每首曲目独立缩放比例。
- 横屏左右滑动翻页。
- 控件自动隐藏和恢复。
- 大 PDF 懒加载和页面释放。

## V0.5 Android 集成

已接入：

- ACTION_VIEW 文件入口。
- ACTION_SEND / ACTION_SEND_MULTIPLE 分享入口。
- 文件管理器“用 Juitar 打开”。
- Android 返回键层级关闭。
- 稳定 Activity 复用。

待真机验证：

- 微信或文件管理器真实分享。
- 真机覆盖升级。
- 应用启动恢复。
- 系统状态栏沉浸。

## 数据结构要求

曲目需要保存：id、title、favorite、lastOpenedAt、lastPageId、lastScrollTop、note、pages。

谱页需要保存：id、type、name、hash、blobId、order。

任何结构变化必须增加 schema 版本、迁移逻辑，并用旧数据和 ZIP 恢复验证。

## 发布门槛

每次发布必须通过：

npm run test
npm run build
powershell -ExecutionPolicy Bypass -File android-lite/build.ps1

同时确认：

- APK v2/v3 签名通过。
- APK 包含 alphaTab worker。
- APK 包含 PDF worker。
- 393×873 HTML 回归通过。
- 模拟器启动。
- 真机项目已记录。
- 工作区干净。
- Git 已提交并推送。

## v0.2.0 实际验收记录

执行日期：2026-10-29。

测试结果：

- npm run test：3 个测试文件、8 个测试通过。
- npm run build：Vite 生产构建通过。
- npm run verify:release：发布资源完整。
- npm run verify:android -- -Serial emulator-5554：Android smoke 通过。
- versionCode=20。
- versionName=0.2.0。

模拟器已确认：

- APK 增量安装成功。
- Juitar Activity 启动。
- alphaTab worker 和 worklet 存在。
- PDF worker 存在。
- 图片 VIEW 入口注册。
- 多文件 SEND_MULTIPLE 入口注册。
- WebView 页面无资源错误。

真实手机专项仍需要设备在线后执行：

- 覆盖安装。
- 文件管理器直接打开图片、PDF、GP。
- 微信或文件管理器多文件分享。
- 屏幕常亮。
- Android 返回键层级关闭。
- 横屏翻页。

## 当前风险

- 真机不持续连接：真机连接后优先验证文件关联、分享和覆盖升级。
- 模拟器桌面 ANR：以 Juitar Activity、WebView 日志和页面截图为准。
- Android 权限差异：使用 content URI 和临时授权。
- 大 PDF 内存占用：后续加入懒加载。
- keystore 只保存在本机：发布时需要安全保存。
- 老数据结构差异：继续通过 normalizeSongs 和 Blob 回退读取。

## 每轮工作顺序

修改代码 → 固定视口验证 → 单元测试 → 生产构建 → APK 构建 → 模拟器或真机验证 → 更新本文件 → 提交并推送。


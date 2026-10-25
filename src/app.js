const VERSION = '0.0.7'
const BASE = './'
const assetUrl = (path) => new URL(path, document.baseURI).href
const isMobileDevice = /Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth <= 760
document.documentElement.classList.toggle('mobile-mode', isMobileDevice)
const alphaTab = window.alphaTab
window.__ALPHATAB__ = alphaTab
const DEFAULT_NOTE = `# 今日练琴

- [m:8-12] 分解和弦换把要放慢，保持每根弦干净。
- 目标速度：75 BPM
- 手感：右手放松，拇指不要压弦。

## 调音与设备

- 调弦：Standard
- 音色：Clean + Room
`
const DEFAULT_TEX = String.raw`\title 'Californian Evening'
\subtitle '真实六线谱练习曲'
\tempo 90
. 0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |
0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |
0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |
0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |
0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |
0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |
0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |
0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |`

const state = {
  view: 'score', speed: 100, isPlaying: false, currentMeasure: 1, loop: null,
  note: localStorage.getItem('juitar:native-note') || DEFAULT_NOTE,
  logs: JSON.parse(localStorage.getItem('juitar:native-logs') || '[]'),
  api: null, scoreReady: false, scoreKind: 'alphatex', timerStartedAt: 0, timerSeconds: 0, timerId: 0,
}

const app = document.querySelector('#app')
app.innerHTML = `
  <header class="topbar">
    <button class="top-icon" id="libraryButton" aria-label="打开曲库">☰</button>
    <div class="song-context"><strong id="songTitle">Californian Evening</strong><span id="scoreState">正在渲染真实六线谱…</span></div>
    <button class="top-import" id="importButton">＋ 导入谱子</button>
    <input id="fileInput" type="file" hidden accept=".gp3,.gp4,.gp5,.gpx,.xml,.musicxml,.jpg,.jpeg,.png,.pdf" />
  </header>
  <main class="main-viewport">
    <section class="view-panel score-panel" data-view="score">
      <div class="score-toolbar"><div><span class="eyebrow">REAL SCORE</span><h1 id="scoreHeading">Californian Evening</h1></div><div class="score-toolbar-meta"><span id="renderBadge">AlphaTex</span><span id="measureLabel">小节 1</span></div></div>
      <div id="scoreViewport" class="score-viewport"><div id="scoreHost" class="score-host"></div></div>
    </section>
    <section class="view-panel notes-panel" data-view="notes" hidden>
      <div class="notes-toolbar"><div><span class="eyebrow">PRACTICE LOG</span><h1>今日练琴</h1></div><button class="small-action" id="newLogButton">＋ 新建打卡</button></div>
      <div class="notes-scroll"><div class="timer-card"><div><span class="eyebrow">SESSION</span><strong id="timerValue">00:00</strong></div><button class="timer-button" id="timerButton">开始计时</button></div><label class="note-label">练习记录<textarea id="noteEditor" spellcheck="false"></textarea></label><div class="note-actions"><button class="small-action" id="previewButton">预览</button><span id="saveState">本地自动保存</span></div><div id="notePreview" class="note-preview" hidden></div><div class="history-title"><span>历史记录</span><span id="logCount">0 条</span></div><div id="historyList" class="history-list"></div></div>
    </section>
  </main>
  <nav class="bottom-bar" aria-label="练习控制"><div class="bottom-tabs"><button class="bottom-tab active" data-view-target="score">看谱</button><button class="bottom-tab" data-view-target="notes">笔记</button></div><button class="bottom-control play-control" id="playButton"><span>▶</span><small>播放</small></button><button class="bottom-control" id="speedButton"><strong id="speedValue">100%</strong><small>BPM</small></button><button class="bottom-control" id="loopButton"><strong>A—B</strong><small id="loopLabel">循环</small></button></nav>
  <aside class="drawer" id="libraryDrawer" aria-hidden="true"><div class="drawer-head"><strong>曲库</strong><button class="top-icon" id="closeDrawer">×</button></div><input class="drawer-search" placeholder="搜索曲目" /><button class="drawer-song active">Californian Evening<span>真实六线谱 · 90 BPM</span></button><button class="drawer-song">Midnight Drive<span>MusicXML · 112 BPM</span></button><button class="drawer-song">Maple Room Etude<span>指弹练习 · 78 BPM</span></button></aside><div class="drawer-scrim" id="drawerScrim" hidden></div>
`

const els = {
  scoreHost: document.querySelector('#scoreHost'), scoreState: document.querySelector('#scoreState'), renderBadge: document.querySelector('#renderBadge'), measureLabel: document.querySelector('#measureLabel'), scoreHeading: document.querySelector('#scoreHeading'), songTitle: document.querySelector('#songTitle'), speed: document.querySelector('#speedValue'), loopLabel: document.querySelector('#loopLabel'), play: document.querySelector('#playButton'), noteEditor: document.querySelector('#noteEditor'), notePreview: document.querySelector('#notePreview'), saveState: document.querySelector('#saveState'), timerValue: document.querySelector('#timerValue'), historyList: document.querySelector('#historyList'), logCount: document.querySelector('#logCount'), drawer: document.querySelector('#libraryDrawer'), scrim: document.querySelector('#drawerScrim'), fileInput: document.querySelector('#fileInput')
}

function escapeHtml(value) { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]) }
function renderNotePreview(value) { let html = escapeHtml(value).replace(/^###? (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>').replace(/^- (.+)$/gm, '<li>$1</li>').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>'); html = html.replace(/\[m:(\d+)(?:-(\d+))?\]/g, (_, start, end) => `<button class="anchor-pill" data-start="${start}" data-end="${end || start}">小节 ${start}${end ? `–${end}` : ''}</button>`); return `<p>${html}</p>` }
function saveNote() { localStorage.setItem('juitar:native-note', state.note); els.saveState.textContent = '已自动保存'; setTimeout(() => { els.saveState.textContent = '本地自动保存' }, 900) }
function renderHistory() { els.logCount.textContent = `${state.logs.length} 条`; els.historyList.innerHTML = state.logs.length ? state.logs.map((log) => `<article class="history-card"><div><strong>${log.date}</strong><span>${log.song} · 目标 ${log.bpm} BPM</span></div><p>${escapeHtml(log.note).slice(0, 140)}</p></article>`).join('') : '<div class="empty-history">还没有练习记录，完成一次练习后保存。</div>' }
function setView(view) { state.view = view; document.querySelectorAll('[data-view]').forEach((panel) => { panel.hidden = panel.dataset.view !== view }); document.querySelectorAll('.bottom-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.viewTarget === view)) }
function setSpeed(value) { state.speed = Math.max(50, Math.min(150, value)); els.speed.textContent = `${state.speed}%`; if (state.api) state.api.playbackSpeed = state.speed / 100 }
function formatTimer(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` }
function toggleTimer() { if (state.timerStartedAt) { clearInterval(state.timerId); state.timerStartedAt = 0; document.querySelector('#timerButton').textContent = '继续计时'; return } state.timerStartedAt = Date.now() - state.timerSeconds * 1000; document.querySelector('#timerButton').textContent = '暂停计时'; state.timerId = setInterval(() => { state.timerSeconds = Math.floor((Date.now() - state.timerStartedAt) / 1000); els.timerValue.textContent = formatTimer(state.timerSeconds) }, 500) }
function setLoop(start = state.currentMeasure, end = start + 4) { state.loop = { start: Number(start), end: Number(end) }; els.loopLabel.textContent = `${state.loop.start}–${state.loop.end}`; if (state.api?.score?.masterBars?.length) { const bars = state.api.score.masterBars; const first = bars[Math.max(0, state.loop.start - 1)]; const after = bars[Math.min(bars.length, state.loop.end)]; if (first) state.api.playbackRange = { startTick: first.start, endTick: after?.start || first.start + 1920 } } }
function jumpToMeasure(start, end = start) { state.currentMeasure = Number(start); els.measureLabel.textContent = `小节 ${state.currentMeasure}`; setLoop(start, end); els.scoreHost.querySelector(`[data-bar-index="${state.currentMeasure - 1}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }

function createAlphaTab() {
  if (!alphaTab?.AlphaTabApi) {
    els.scoreState.textContent = '直接双击模式：可导入图片/PDF；真实六线谱请使用 APK 或本地开发服务'
    els.renderBadge.textContent = 'OFFLINE FILE'
    els.scoreHost.innerHTML = '<div class="direct-file-help"><strong>页面已打开</strong><p>浏览器的 file:// 安全策略会阻止 alphaTab worker。请运行 <code>npm run dev</code>，或直接使用 Android APK 查看真实六线谱。</p></div>'
    return
  }
  try {
    const scale = isMobileDevice ? 0.78 : 1.05
    state.api = new alphaTab.AlphaTabApi(els.scoreHost, { core: { engine: 'svg', scriptFile: assetUrl('alphatab/alphaTab.min.js'), fontDirectory: assetUrl('font/') }, display: { scale, staveProfile: 'tab' }, player: { enablePlayer: true, soundFont: assetUrl('soundfont/sonivox.sf2') } })
    state.api.renderFinished.on(() => { state.scoreReady = true; els.scoreState.textContent = '真实六线谱已渲染'; els.renderBadge.textContent = 'AlphaTex · READY'; els.scoreHost.classList.add('ready') })
    state.api.error.on((error) => { console.error('[Juitar] alphaTab error', error); els.scoreState.textContent = `谱面错误：${error.message || error}`; els.scoreState.classList.add('error') })
    state.api.playerStateChanged.on((event) => { state.isPlaying = event.state === alphaTab.synth.PlayerState.Playing; els.play.classList.toggle('playing', state.isPlaying); els.play.querySelector('span').textContent = state.isPlaying ? 'Ⅱ' : '▶' })
    state.api.playerPositionChanged.on((event) => { const total = state.api.score?.masterBars?.length || 16; if (state.isPlaying && event.endTick > 0) { state.currentMeasure = Math.max(1, Math.min(total, Math.floor((event.currentTick / event.endTick) * total) + 1)); els.measureLabel.textContent = `小节 ${state.currentMeasure}` } })
    state.api.tex(DEFAULT_TEX)
  } catch (error) { els.scoreState.textContent = `谱面初始化失败：${error.message}`; els.scoreState.classList.add('error') }
}

function handleImportedFile(file) {
  if (!file) return
  const type = file.type || ''
  state.scoreReady = false; els.scoreHost.classList.remove('ready'); els.scoreHost.innerHTML = ''
  if (type.startsWith('image/')) { const image = new Image(); image.src = URL.createObjectURL(file); image.alt = file.name; image.onload = () => URL.revokeObjectURL(image.src); els.scoreHost.append(image); els.scoreState.textContent = '图片谱 · 可缩放滚动'; els.renderBadge.textContent = 'IMAGE'; return }
  if (type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) { const frame = document.createElement('iframe'); frame.className = 'pdf-frame'; frame.src = URL.createObjectURL(file); frame.title = file.name; els.scoreHost.append(frame); els.scoreState.textContent = 'PDF 谱 · 可滚动查看'; els.renderBadge.textContent = 'PDF'; return }
  file.arrayBuffer().then((buffer) => { els.scoreState.textContent = '正在渲染导入曲谱…'; els.renderBadge.textContent = 'IMPORT'; state.api.load(new Uint8Array(buffer)) }).catch((error) => { els.scoreState.textContent = `导入失败：${error.message}` })
}

document.querySelectorAll('[data-view-target]').forEach((tab) => tab.addEventListener('click', () => setView(tab.dataset.viewTarget)))
els.noteEditor.value = state.note
els.noteEditor.addEventListener('input', () => { state.note = els.noteEditor.value; saveNote() })
document.querySelector('#previewButton').addEventListener('click', () => { els.notePreview.hidden = !els.notePreview.hidden; els.notePreview.innerHTML = renderNotePreview(state.note); document.querySelector('#previewButton').textContent = els.notePreview.hidden ? '预览' : '返回编辑' })
els.notePreview.addEventListener('click', (event) => { const anchor = event.target.closest('[data-start]'); if (!anchor) return; setView('score'); jumpToMeasure(anchor.dataset.start, anchor.dataset.end) })
document.querySelector('#newLogButton').addEventListener('click', () => { const log = { date: new Date().toLocaleString('zh-CN', { hour12: false }), song: els.songTitle.textContent, bpm: Math.round(90 * state.speed / 100), note: state.note }; state.logs.unshift(log); localStorage.setItem('juitar:native-logs', JSON.stringify(state.logs)); renderHistory(); setView('notes') })
document.querySelector('#timerButton').addEventListener('click', toggleTimer)
els.play.addEventListener('click', () => state.api?.playPause())
document.querySelector('#speedButton').addEventListener('click', () => setSpeed(state.speed === 100 ? 80 : state.speed === 80 ? 70 : 100))
document.querySelector('#loopButton').addEventListener('click', () => setLoop())
document.querySelector('#importButton').addEventListener('click', () => els.fileInput.click())
els.fileInput.addEventListener('change', (event) => handleImportedFile(event.target.files[0]))
document.querySelector('#libraryButton').addEventListener('click', () => { els.drawer.classList.add('open'); els.drawer.setAttribute('aria-hidden', 'false'); els.scrim.hidden = false })
function closeDrawer() { els.drawer.classList.remove('open'); els.drawer.setAttribute('aria-hidden', 'true'); els.scrim.hidden = true }
document.querySelector('#closeDrawer').addEventListener('click', closeDrawer); els.scrim.addEventListener('click', closeDrawer)
document.querySelectorAll('.drawer-song').forEach((song) => song.addEventListener('click', () => { document.querySelectorAll('.drawer-song').forEach((item) => item.classList.remove('active')); song.classList.add('active'); els.songTitle.textContent = song.childNodes[0].textContent.trim(); els.scoreHeading.textContent = els.songTitle.textContent; closeDrawer() }))
renderHistory(); createAlphaTab()

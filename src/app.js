const VERSION = '0.0.10'
const alphaTab = window.alphaTab
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth <= 760
const assetUrl = (path) => new URL(path, document.baseURI).href
document.documentElement.classList.toggle('mobile-mode', isMobile)

const DEFAULT_TITLE = 'Californian Evening'
const DEFAULT_TEX = [
  "\\title 'Californian Evening'",
  "\\subtitle 'Guitar standard tuning'",
  "\\tempo 90",
  '. 0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |',
  '0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |',
  '0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |',
  '0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |',
  '0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |',
  '0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |',
  '0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |',
  '0.6 2.5 2.4 1.3 0.2 0.1 | 3.6 2.5 0.4 0.3 0.2 3.1 |',
].join('\n')

const state = {
  title: DEFAULT_TITLE, kind: 'alphatex', api: null, ready: false, objectUrl: null,
  measure: 1, bpm: 90, playing: false, note: localStorage.getItem('juitar:note:v2') || '',
  library: JSON.parse(localStorage.getItem('juitar:library:v2') || '[]'), pinch: { active: false, distance: 0, scale: 1 },
}

const app = document.querySelector('#app')
app.innerHTML = '\
  <header class="topbar">\
    <button class="icon-button" id="libraryButton" aria-label="打开谱夹">📁 <span>谱夹</span></button>\
    <div class="current-title" id="songTitle"></div>\
    <button class="import-button" id="importButton">＋ 导入谱子</button>\
    <input id="fileInput" type="file" hidden accept=".jpg,.jpeg,.png,.pdf,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml,image/jpeg,image/png,application/pdf,application/octet-stream,application/xml,text/xml" />\
  </header>\
  <main class="score-main"><div class="score-scroll" id="scoreScroll"><div class="score-host" id="scoreHost" aria-live="polite"></div></div></main>\
  <div class="score-status" id="scoreStatus"></div>\
  <div class="float-player" id="floatPlayer" hidden>\
    <button id="playButton" aria-label="播放或暂停"><span>▶</span></button><button id="bpmDown" aria-label="降低 BPM">−5</button><strong id="bpmValue">90 BPM</strong><button id="bpmUp" aria-label="提高 BPM">＋5</button>\
  </div>\
  <button class="note-fab" id="noteFab" aria-label="打开笔记">📝</button>\
  <div class="drawer-scrim" id="drawerScrim" hidden></div>\
  <aside class="library-drawer" id="libraryDrawer" aria-hidden="true"><div class="drawer-head"><strong>我的谱夹</strong><button class="close-button" id="closeLibrary" aria-label="关闭">×</button></div><button class="new-song-button" id="newSongButton">＋ 新建曲子</button><p class="drawer-hint">导入图片、PDF、GP/MusicXML，或新建一份可直接查看的练习曲模板。</p><div class="library-list" id="libraryList"></div></aside>\
  <aside class="note-drawer" id="noteDrawer" aria-hidden="true"><div class="drawer-handle" id="noteHandle"></div><div class="note-head"><strong>《<span id="noteSongTitle"></span>》笔记</strong><span id="noteSaved">自动保存</span></div><textarea id="noteEditor" placeholder="记录这首曲子的指法、难点或想法…&#10;&#10;可写 [m:12] 跳到第 12 小节"></textarea><div class="note-footer"><button class="note-anchor" id="jumpAnchor">跳到笔记中的小节</button><span>点击遮罩或下滑收起</span></div></aside>\
  <div class="new-song-modal" id="newSongModal" hidden><div class="new-song-card"><div class="new-song-head"><strong>新建曲子</strong><button class="close-button" id="cancelNewSong" aria-label="关闭">×</button></div><p>先创建一份可直接查看的内置六线谱，之后也可以再导入 GP 或 MusicXML 替换。</p><label for="newSongName">曲名</label><input id="newSongName" type="text" maxlength="80" placeholder="例如：我的指弹练习" /><div class="new-song-actions"><button class="secondary-button" id="cancelNewSongBottom">取消</button><button class="primary-button" id="createNewSong">创建并打开</button></div></div></div>'

const els = {
  title: document.querySelector('#songTitle'), noteTitle: document.querySelector('#noteSongTitle'), host: document.querySelector('#scoreHost'),
  scroll: document.querySelector('#scoreScroll'), status: document.querySelector('#scoreStatus'), file: document.querySelector('#fileInput'),
  player: document.querySelector('#floatPlayer'), play: document.querySelector('#playButton'), bpm: document.querySelector('#bpmValue'),
  library: document.querySelector('#libraryDrawer'), libraryList: document.querySelector('#libraryList'), scrim: document.querySelector('#drawerScrim'),
  noteDrawer: document.querySelector('#noteDrawer'), noteEditor: document.querySelector('#noteEditor'), noteSaved: document.querySelector('#noteSaved'),
  newSongModal: document.querySelector('#newSongModal'), newSongName: document.querySelector('#newSongName'),
}

function escapeHtml(value) { return String(value).replace(/[&<>"]/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] }) }
function noteStorageKey(title) { return 'juitar:note:v2:' + title }
function setTitle(title) { state.title = title || DEFAULT_TITLE; state.note = localStorage.getItem(noteStorageKey(state.title)) || (state.title === DEFAULT_TITLE ? localStorage.getItem('juitar:note:v2') || '' : ''); els.title.textContent = state.title; els.title.title = state.title; els.noteTitle.textContent = state.title; if (els.noteEditor) els.noteEditor.value = state.note; document.title = 'Juitar · ' + state.title }
function setStatus(text, error) { els.status.textContent = text; els.status.classList.toggle('error', Boolean(error)); els.status.classList.toggle('visible', Boolean(text)); clearTimeout(setStatus.timer); if (!error && text.indexOf('已') >= 0) setStatus.timer = setTimeout(function () { els.status.classList.remove('visible') }, 1800) }
function revokeObjectUrl() { if (state.objectUrl) URL.revokeObjectURL(state.objectUrl); state.objectUrl = null }
function setKind(kind) { state.kind = kind; els.player.hidden = !['alphatex', 'gp', 'musicxml'].includes(kind) }

function persistLibrary() { localStorage.setItem('juitar:library:v2', JSON.stringify(state.library.slice(0, 40))) }
function openDb() {
  return new Promise(function (resolve) {
    if (!('indexedDB' in window)) return resolve(null)
    const request = indexedDB.open('juitar-v2', 1)
    request.onupgradeneeded = function () { request.result.createObjectStore('files') }
    request.onsuccess = function () { resolve(request.result) }
    request.onerror = function () { resolve(null) }
  })
}
async function saveBlob(id, file) {
  const db = await openDb(); if (!db) return
  await new Promise(function (resolve) { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(file, id); tx.oncomplete = resolve; tx.onerror = resolve })
}
async function readBlob(id) {
  const db = await openDb(); if (!db) return null
  return new Promise(function (resolve) { const tx = db.transaction('files', 'readonly'); const request = tx.objectStore('files').get(id); request.onsuccess = function () { resolve(request.result || null) }; request.onerror = function () { resolve(null) } })
}
async function addToLibrary(file, kind) {
  const id = Date.now() + '-' + Math.random().toString(16).slice(2)
  state.library = [{ id: id, name: file.name, kind: kind, size: file.size, addedAt: Date.now() }].concat(state.library.filter(function (entry) { return entry.name !== file.name })).slice(0, 40)
  persistLibrary(); await saveBlob(id, file); renderLibrary()
}
function fileKind(file) {
  const name = file.name.toLowerCase()
  if (file.type.indexOf('image/') === 0 || /\.(jpg|jpeg|png)$/i.test(name)) return 'image'
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (/\.(gp3|gp4|gp5|gpx)$/i.test(name)) return 'gp'
  if (/\.(xml|musicxml)$/i.test(name) || file.type.indexOf('xml') >= 0) return 'musicxml'
  if (name.endsWith('.atex') || file.type === 'text/x-alphatex') return 'alphatex'
  return null
}
function clearScore() { revokeObjectUrl(); els.host.replaceChildren(); els.host.className = 'score-host'; state.ready = false; state.measure = 1 }
function showImage(file) {
  clearScore(); state.objectUrl = URL.createObjectURL(file)
  const stage = document.createElement('div'); stage.className = 'image-stage'
  const image = document.createElement('img'); image.src = state.objectUrl; image.alt = file.name; image.draggable = false
  stage.append(image); els.host.append(stage); setKind('image'); setTitle(file.name.replace(/\.[^.]+$/, '')); setStatus('图片谱已打开'); enablePinchZoom(stage, image)
}
function showPdf(file) {
  clearScore(); state.objectUrl = URL.createObjectURL(file)
  const frame = document.createElement('iframe'); frame.className = 'pdf-viewer'; frame.src = state.objectUrl; frame.title = file.name
  els.host.append(frame); setKind('pdf'); setTitle(file.name.replace(/\.[^.]+$/, '')); setStatus('PDF 谱已打开')
}
function showAlphaTabFile(file, kind) {
  if (!state.api) return setStatus('当前页面未加载 alphaTab，请使用 npm run dev 或 APK', true)
  clearScore(); setKind(kind); setTitle(file.name.replace(/\.[^.]+$/, '')); setStatus('正在渲染真实谱面…')
  file.arrayBuffer().then(function (buffer) { initializeAlphaTabApi(kind); state.api.load(new Uint8Array(buffer)) }).catch(function (error) { setStatus('导入失败：' + error.message, true) })
}
function showAlphaTexText(text, title) {
  if (!state.api) return setStatus('当前页面未加载 alphaTab，请使用 npm run dev 或 APK', true)
  setKind('alphatex'); setTitle(title); setStatus('正在渲染新建曲子…')
  try { initializeAlphaTabApi(); state.api.tex(text) } catch (error) { setStatus('新建曲子失败：' + error.message, true) }
}
function handleFile(file, shouldStore) {
  if (!file) return
  const kind = fileKind(file)
  if (!kind) return setStatus('不支持此格式，请选择图片、PDF、GP3/4/5、GPX 或 MusicXML', true)
  if (shouldStore !== false) addToLibrary(file, kind)
  if (kind === 'image') showImage(file); else if (kind === 'pdf') showPdf(file); else if (kind === 'alphatex') file.text().then(function (text) { showAlphaTexText(text, file.name.replace(/\.atex$/i, '')) }); else showAlphaTabFile(file, kind)
}
function renderLibrary() {
  if (!state.library.length) {
    els.libraryList.innerHTML = '<div class="library-empty">还没有谱子<br><small>点击右上角“＋ 导入谱子”开始</small></div>'; return
  }
  els.libraryList.innerHTML = state.library.map(function (item) {
    return '<button class="library-item" data-file-id="' + item.id + '"><span class="library-icon">' + (item.kind === 'image' ? '🖼️' : item.kind === 'pdf' ? '📄' : '🎼') + '</span><span class="library-copy"><strong>' + escapeHtml(item.name.replace(/\.atex$/i, '')) + '</strong><small>' + item.kind.toUpperCase() + ' · ' + new Date(item.addedAt).toLocaleDateString('zh-CN') + '</small></span><span class="library-arrow">›</span></button>'
  }).join('')
  els.libraryList.querySelectorAll('[data-file-id]').forEach(function (button) { button.addEventListener('click', async function () {
    const item = state.library.find(function (entry) { return entry.id === button.dataset.fileId }); const blob = item && await readBlob(item.id)
    if (!blob) return setStatus('该文件只保存了名称，请重新导入原文件', true)
    handleFile(new File([blob], item.name, { type: blob.type }), false); closeLibrary()
  }) })
}
function openNewSong() {
  closeLibrary(); els.newSongModal.hidden = false; els.newSongName.value = ''; requestAnimationFrame(function () { els.newSongName.focus() })
}
function closeNewSong() { els.newSongModal.hidden = true }
function createNewSong() {
  const title = els.newSongName.value.trim() || '我的新曲子'
  const tex = DEFAULT_TEX.replace("\\title 'Californian Evening'", "\\title '" + title.replace(/'/g, "\\'") + "'")
  const file = new File([tex], title + '.atex', { type: 'text/x-alphatex' })
  closeNewSong(); addToLibrary(file, 'alphatex'); showAlphaTexText(tex, title); setStatus('新曲子已创建')
}
function initializeAlphaTabApi(kind) {
  if (!alphaTab || !alphaTab.AlphaTabApi) {
    setStatus('直接打开 HTML 时无法启动 alphaTab，请使用 npm run dev 或 APK', true)
    els.host.innerHTML = '<div class="runtime-help"><strong>需要本地运行环境</strong><p>图片和 PDF 可以直接导入；GP/MusicXML 与默认六线谱请通过 APK 或 <code>npm run dev</code> 打开。</p></div>'; setKind('alphatex'); return
  }
  try {
    if (state.api && typeof state.api.destroy === 'function') state.api.destroy()
    els.host.replaceChildren()
    setKind('alphatex')
    state.api = new alphaTab.AlphaTabApi(els.host, {
      core: { engine: 'svg', scriptFile: assetUrl('alphatab/alphaTab.min.js'), fontDirectory: assetUrl('font/') },
      display: { scale: isMobile ? 0.86 : 1.05, staveProfile: kind === 'musicxml' ? 'default' : 'tab', layoutMode: 'page' },
      player: { enablePlayer: true, soundFont: assetUrl('soundfont/sonivox.sf2') },
    })
    state.api.renderFinished.on(function () { if (!['alphatex', 'gp', 'musicxml'].includes(state.kind)) return; state.ready = true; els.host.classList.add('ready'); setStatus('真实六线谱已渲染') })
    state.api.error.on(function (error) { setStatus('谱面错误：' + (error.message || error), true) })
    state.api.playerStateChanged.on(function (event) { state.playing = event.state === alphaTab.synth.PlayerState.Playing; els.play.classList.toggle('playing', state.playing); els.play.querySelector('span').textContent = state.playing ? 'Ⅱ' : '▶' })
    state.api.playerPositionChanged.on(function (event) { if (event.currentTick <= 0 || !state.api.score || !state.api.score.masterBars.length) return; state.measure = Math.max(1, Math.min(state.api.score.masterBars.length, Math.floor((event.currentTick / Math.max(event.endTick, 1)) * state.api.score.masterBars.length) + 1)) })
  } catch (error) { setStatus('谱面初始化失败：' + error.message, true) }
}
function createAlphaTab() { initializeAlphaTabApi(); if (state.api) state.api.tex(DEFAULT_TEX) }
function setBpm(value) { state.bpm = Math.max(40, Math.min(220, value)); els.bpm.textContent = state.bpm + ' BPM'; if (state.api) state.api.playbackSpeed = state.bpm / 90 }
function jumpToMeasure(start) {
  const index = Math.max(1, Number(start) || 1); state.measure = index
  const target = els.host.querySelector('[data-bar-index="' + (index - 1) + '"]')
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' }); else els.scroll.scrollTo({ top: Math.max(0, (index - 1) * 180), behavior: 'smooth' })
  closeNotes()
}
function parseAnchor() { const match = state.note.match(/\[m:(\d+)\]/); return match ? Number(match[1]) : null }
function saveNote() { state.note = els.noteEditor.value; localStorage.setItem(noteStorageKey(state.title), state.note); els.noteSaved.textContent = '已保存'; clearTimeout(saveNote.timer); saveNote.timer = setTimeout(function () { els.noteSaved.textContent = '自动保存' }, 900) }
function openNotes() { els.noteDrawer.classList.add('open'); els.noteDrawer.setAttribute('aria-hidden', 'false'); els.scrim.hidden = false; requestAnimationFrame(function () { els.noteEditor.focus({ preventScroll: true }) }) }
function closeNotes() { els.noteDrawer.classList.remove('open'); els.noteDrawer.setAttribute('aria-hidden', 'true'); if (!els.library.classList.contains('open')) els.scrim.hidden = true }
function openLibrary() { els.library.classList.add('open'); els.library.setAttribute('aria-hidden', 'false'); els.scrim.hidden = false }
function closeLibrary() { els.library.classList.remove('open'); els.library.setAttribute('aria-hidden', 'true'); if (!els.noteDrawer.classList.contains('open')) els.scrim.hidden = true }
function enablePinchZoom(stage, image) {
  stage._pointers = {}
  stage.addEventListener('pointerdown', function (event) { stage.setPointerCapture(event.pointerId); stage._pointers[event.pointerId] = event })
  stage.addEventListener('pointermove', function (event) {
    if (!stage._pointers[event.pointerId]) return
    stage._pointers[event.pointerId] = event; const points = Object.values(stage._pointers); if (points.length < 2) return
    const distance = Math.hypot(points[0].clientX - points[1].clientX, points[0].clientY - points[1].clientY)
    if (!state.pinch.active) { state.pinch.active = true; state.pinch.distance = distance; state.pinch.scale = 1 }
    const next = Math.max(1, Math.min(3.5, state.pinch.scale * (distance / state.pinch.distance))); image.style.transform = 'scale(' + next + ')'
  })
  const clear = function (event) { delete stage._pointers[event.pointerId]; if (Object.keys(stage._pointers).length < 2) state.pinch.active = false }
  stage.addEventListener('pointerup', clear); stage.addEventListener('pointercancel', clear); stage.addEventListener('pointerleave', clear)
}

document.querySelector('#importButton').addEventListener('click', function () { els.file.click() })
els.file.addEventListener('change', function (event) { handleFile(event.target.files && event.target.files[0]); event.target.value = '' })
document.querySelector('#libraryButton').addEventListener('click', openLibrary)
document.querySelector('#closeLibrary').addEventListener('click', closeLibrary)
document.querySelector('#newSongButton').addEventListener('click', openNewSong)
document.querySelector('#cancelNewSong').addEventListener('click', closeNewSong)
document.querySelector('#cancelNewSongBottom').addEventListener('click', closeNewSong)
document.querySelector('#createNewSong').addEventListener('click', createNewSong)
els.newSongName.addEventListener('keydown', function (event) { if (event.key === 'Enter') createNewSong() })
document.querySelector('#noteFab').addEventListener('click', openNotes)
document.querySelector('#drawerScrim').addEventListener('click', function () { closeLibrary(); closeNotes() })
document.querySelector('#playButton').addEventListener('click', function () { if (state.api) state.api.playPause() })
document.querySelector('#bpmDown').addEventListener('click', function () { setBpm(state.bpm - 5) })
document.querySelector('#bpmUp').addEventListener('click', function () { setBpm(state.bpm + 5) })
document.querySelector('#jumpAnchor').addEventListener('click', function () { const anchor = parseAnchor(); if (anchor) jumpToMeasure(anchor); else { els.noteEditor.focus(); setStatus('笔记中还没有 [m:小节号] 标记') } })
els.noteEditor.value = state.note
els.noteEditor.addEventListener('input', saveNote)
let noteStartY = 0
els.noteDrawer.addEventListener('touchstart', function (event) { noteStartY = event.touches[0] ? event.touches[0].clientY : 0 }, { passive: true })
els.noteDrawer.addEventListener('touchend', function (event) { const endY = event.changedTouches[0] ? event.changedTouches[0].clientY : noteStartY; if (endY - noteStartY > 60) closeNotes() }, { passive: true })
renderLibrary()
setTitle(DEFAULT_TITLE)
createAlphaTab()

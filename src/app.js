const VERSION = '0.1.0'
const alphaTab = window.alphaTab
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth <= 760
const assetUrl = (path) => new URL(path, document.baseURI).href
const SONGS_KEY = 'juitar:songs:v3'
const CURRENT_SONG_KEY = 'juitar:current-song:v3'
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

const uid = (prefix) => prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(16).slice(2)
const stripExt = (name) => String(name).replace(/\.[^.]+$/, '')
const oldLibrary = JSON.parse(localStorage.getItem('juitar:library:v2') || '[]')
const defaultSong = () => ({ id: 'song-default', title: DEFAULT_TITLE, note: '', lastPageId: 'page-default', lastScrollTop: 0, createdAt: Date.now(), updatedAt: Date.now(), pages: [{ id: 'page-default', type: 'alphatex', name: '默认六线谱', text: DEFAULT_TEX }] })
const normalizeSongs = (songs) => songs.map((song) => ({ ...song, favorite: Boolean(song.favorite), lastOpenedAt: Number(song.lastOpenedAt) || Number(song.updatedAt) || Date.now(), lastPageId: song.lastPageId || null, lastScrollTop: Number(song.lastScrollTop) || 0, pages: (song.pages || []).map((page) => page.text ? { ...page, text: page.text.replace(/\\n/g, '\n') } : page) }))
const migrateSongs = () => {
  const saved = JSON.parse(localStorage.getItem(SONGS_KEY) || 'null')
  if (Array.isArray(saved) && saved.length) return normalizeSongs(saved)
  if (oldLibrary.length) return oldLibrary.map((item) => ({
    id: 'song-' + item.id,
    title: stripExt(item.name),
    note: '',
    createdAt: item.addedAt || Date.now(),
    updatedAt: item.addedAt || Date.now(),
    lastPageId: null,
    lastScrollTop: 0,
    pages: [{ id: 'page-' + item.id, type: item.kind, name: item.name, blobId: item.id }],
  }))
  return [defaultSong()]
}

const state = {
  songs: migrateSongs(),
  currentSongId: localStorage.getItem(CURRENT_SONG_KEY) || null,
  currentPageId: null,
  api: null,
  renderToken: 0,
  kind: 'alphatex',
  hasVector: false,
  bpm: 90,
  playing: false,
  objectUrls: [],
  pinch: { active: false, distance: 0, scale: 1 },
  scrollSaveTimer: 0,
  pendingFiles: [],
  libraryQuery: '',
  libraryFilter: 'all',
  songModalMode: 'create',
  wakeLock: null,
  keepAwake: false,
  immersive: false,
}

if (!state.currentSongId || !state.songs.some((song) => song.id === state.currentSongId)) state.currentSongId = state.songs[0].id

const app = document.querySelector('#app')
app.innerHTML = '\
  <header class="topbar">\
    <button class="icon-button" id="libraryButton" aria-label="打开谱夹">📁 <span>谱夹</span></button>\
    <div class="current-title" id="songTitle"></div>\
    <button class="import-button" id="importButton">＋ 添加谱页</button>\
    <input id="fileInput" type="file" hidden multiple accept=".jpg,.jpeg,.png,.pdf,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml,.atex,image/jpeg,image/png,application/pdf,application/octet-stream,application/xml,text/xml,text/x-alphatex" />\
  </header>\
  <main class="score-main"><div class="score-scroll" id="scoreScroll"><div class="score-host" id="scoreHost" aria-live="polite"></div></div></main>\
  <div class="score-status" id="scoreStatus"></div><div class="score-progress" id="scoreProgress">第 1 / 1 页</div>\
  <div class="float-player" id="floatPlayer" hidden>\
    <button id="playButton" aria-label="播放或暂停"><span>▶</span></button><button id="bpmDown" aria-label="降低 BPM">−5</button><strong id="bpmValue">90 BPM</strong><button id="bpmUp" aria-label="提高 BPM">＋5</button>\
  </div>\
  <button class="note-fab" id="noteFab" aria-label="打开笔记">📝</button>\
  <div class="drawer-scrim" id="drawerScrim" hidden></div>\
  <aside class="library-drawer" id="libraryDrawer" aria-hidden="true"><div class="drawer-head"><strong>我的谱夹</strong><button class="close-button" id="closeLibrary" aria-label="关闭">×</button></div><button class="new-song-button" id="newSongButton">＋ 新建曲子</button><div class="library-tools"><input id="librarySearch" type="search" placeholder="搜索曲目" /><button data-library-filter="all" class="active">全部</button><button data-library-filter="recent">最近</button><button data-library-filter="favorite">收藏</button></div><p class="drawer-hint">选择曲目继续阅读，也可以在下面管理当前曲目。</p><div class="library-list" id="libraryList"></div><section class="page-manager" id="pageManager"></section><section class="library-actions"><button id="renameSongButton">重命名当前曲目</button><button id="exportZipButton">导出曲目备份</button><button id="wakeLockButton">保持屏幕常亮</button><button id="immersiveButton">沉浸模式</button></section></aside>\
  <aside class="note-drawer" id="noteDrawer" aria-hidden="true"><div class="drawer-handle"></div><div class="note-head"><strong>《<span id="noteSongTitle"></span>》笔记</strong><span id="noteSaved">自动保存</span></div><textarea id="noteEditor" placeholder="写下练习感受、指法、难点或下次要注意的地方…"></textarea><div class="note-footer"><button class="note-anchor" id="restorePositionButton">回到上次阅读位置</button><span>点击遮罩或下滑收起</span></div></aside>\
  <div class="import-modal" id="importModal" hidden><div class="import-card"><div class="new-song-head"><strong>导入谱页</strong><button class="close-button" id="cancelImport" aria-label="关闭">×</button></div><p>已选择 <span id="importCount">0</span> 个文件。请选择放入位置。</p><div class="import-file-list" id="importFileList"></div><div class="new-song-actions"><button class="secondary-button" id="importAsNew">新建曲目并加入</button><button class="primary-button" id="importIntoCurrent">加入当前曲目</button></div></div></div>\
  <div class="new-song-modal" id="newSongModal" hidden><div class="new-song-card"><div class="new-song-head"><strong id="songModalTitle">新建曲子</strong><button class="close-button" id="cancelNewSong" aria-label="关闭">×</button></div><p id="songModalHint">新曲目会先带一份可直接查看的六线谱模板，之后可以继续添加多张谱页。</p><label for="newSongName">曲名</label><input id="newSongName" type="text" maxlength="80" placeholder="例如：Hotel California" /><div class="new-song-actions"><button class="secondary-button" id="cancelNewSongBottom">取消</button><button class="primary-button" id="createNewSong">创建并打开</button></div></div></div>'

const els = {
  title: document.querySelector('#songTitle'), noteTitle: document.querySelector('#noteSongTitle'), host: document.querySelector('#scoreHost'),
  scroll: document.querySelector('#scoreScroll'), status: document.querySelector('#scoreStatus'), file: document.querySelector('#fileInput'),
  player: document.querySelector('#floatPlayer'), play: document.querySelector('#playButton'), bpm: document.querySelector('#bpmValue'), progress: document.querySelector('#scoreProgress'),
  library: document.querySelector('#libraryDrawer'), libraryList: document.querySelector('#libraryList'), scrim: document.querySelector('#drawerScrim'),
  noteDrawer: document.querySelector('#noteDrawer'), noteEditor: document.querySelector('#noteEditor'), noteSaved: document.querySelector('#noteSaved'),
  newSongModal: document.querySelector('#newSongModal'), newSongName: document.querySelector('#newSongName'), songModalTitle: document.querySelector('#songModalTitle'), songModalHint: document.querySelector('#songModalHint'), pageManager: document.querySelector('#pageManager'), importModal: document.querySelector('#importModal'), importFileList: document.querySelector('#importFileList'), importCount: document.querySelector('#importCount'), librarySearch: document.querySelector('#librarySearch'), renameSong: document.querySelector('#renameSongButton'), exportZip: document.querySelector('#exportZipButton'), wakeLock: document.querySelector('#wakeLockButton'), immersive: document.querySelector('#immersiveButton'),
}

function currentSong() { return state.songs.find((song) => song.id === state.currentSongId) || state.songs[0] }
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]) }
function saveSongs() { localStorage.setItem(SONGS_KEY, JSON.stringify(state.songs)); localStorage.setItem(CURRENT_SONG_KEY, state.currentSongId) }
function setStatus(text, error = false) { els.status.textContent = text; els.status.classList.toggle('error', error); els.status.classList.toggle('visible', Boolean(text)); clearTimeout(setStatus.timer); if (!error && text.includes('已')) setStatus.timer = setTimeout(() => els.status.classList.remove('visible'), 1800) }
function setTitle(title) { els.title.textContent = title; els.title.title = title; els.noteTitle.textContent = title; document.title = 'Juitar · ' + title }
function setKind(kind) { state.kind = kind; els.player.hidden = !state.hasVector }
function revokeObjectUrls() { state.objectUrls.forEach((url) => URL.revokeObjectURL(url)); state.objectUrls = [] }
function openDb(name = 'juitar-v3') {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) return resolve(null)
    const request = indexedDB.open(name, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('files')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}
async function saveBlob(id, file) {
  const db = await openDb(); if (!db) return
  await new Promise((resolve) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(file, id); tx.oncomplete = resolve; tx.onerror = resolve })
}
async function readBlob(id) {
  const readFrom = async (name) => {
    const db = await openDb(name); if (!db) return null
    return new Promise((resolve) => { const tx = db.transaction('files', 'readonly'); const request = tx.objectStore('files').get(id); request.onsuccess = () => resolve(request.result || null); request.onerror = () => resolve(null) })
  }
  return (await readFrom('juitar-v3')) || (await readFrom('juitar-v2'))
}
function fileKind(file) {
  const name = file.name.toLowerCase()
  if (file.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(name)) return 'image'
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (/\.(gp3|gp4|gp5|gpx)$/i.test(name)) return 'gp'
  if (/\.(xml|musicxml)$/i.test(name) || file.type.includes('xml')) return 'musicxml'
  if (name.endsWith('.atex') || file.type === 'text/x-alphatex') return 'alphatex'
  return null
}
function destroyApi() { if (state.api && typeof state.api.destroy === 'function') state.api.destroy(); state.api = null }
function clearScore() { destroyApi(); revokeObjectUrls(); els.host.replaceChildren(); els.host.className = 'score-host'; state.hasVector = false; state.playing = false; els.player.hidden = true; state.renderToken += 1 }
function touchSong(song) { song.lastOpenedAt = Date.now(); song.updatedAt = Date.now(); saveSongs() }
function setSong(song) { state.currentSongId = song.id; state.currentPageId = song.lastPageId || null; touchSong(song); setTitle(song.title); els.noteEditor.value = song.note || ''; renderLibrary() }
function updateProgress() {
  const pages = Array.from(els.host.querySelectorAll('.score-page'))
  if (!pages.length) { els.progress.textContent = '暂无谱页'; return }
  const anchor = els.scroll.getBoundingClientRect().top + 24
  let index = 0
  pages.forEach((page, candidate) => { if (page.getBoundingClientRect().top <= anchor) index = candidate })
  const song = currentSong(); const page = pages[index]
  state.currentPageId = page.dataset.pageId
  song.lastPageId = state.currentPageId
  song.lastScrollTop = els.scroll.scrollTop
  els.progress.textContent = '第 ' + (index + 1) + ' / ' + pages.length + ' 页'
  clearTimeout(state.scrollSaveTimer)
  state.scrollSaveTimer = setTimeout(saveSongs, 350)
}
function enablePinchZoom(stage, image) {
  stage._pointers = {}
  stage.addEventListener('pointerdown', (event) => { stage.setPointerCapture(event.pointerId); stage._pointers[event.pointerId] = event })
  stage.addEventListener('pointermove', (event) => {
    if (!stage._pointers[event.pointerId]) return
    stage._pointers[event.pointerId] = event; const points = Object.values(stage._pointers); if (points.length < 2) return
    const distance = Math.hypot(points[0].clientX - points[1].clientX, points[0].clientY - points[1].clientY)
    if (!state.pinch.active) { state.pinch.active = true; state.pinch.distance = distance; state.pinch.scale = 1 }
    image.style.transform = 'scale(' + Math.max(1, Math.min(3.5, state.pinch.scale * (distance / state.pinch.distance))) + ')'
  })
  const clear = (event) => { delete stage._pointers[event.pointerId]; if (Object.keys(stage._pointers).length < 2) state.pinch.active = false }
  stage.addEventListener('pointerup', clear); stage.addEventListener('pointercancel', clear); stage.addEventListener('pointerleave', clear)
}
function appendImagePage(page, blob, index) {
  const stage = document.createElement('section'); stage.className = 'score-page image-stage'; stage.dataset.pageId = page.id
  const label = document.createElement('div'); label.className = 'page-label'; label.textContent = '第 ' + (index + 1) + ' 页'
  const image = document.createElement('img'); image.alt = page.name; image.draggable = false
  const url = URL.createObjectURL(blob); state.objectUrls.push(url); image.src = url
  stage.append(label, image); els.host.append(stage); enablePinchZoom(stage, image)
}
function appendPdfPage(page, blob, index) {
  const stage = document.createElement('section'); stage.className = 'score-page pdf-stage'; stage.dataset.pageId = page.id
  const label = document.createElement('div'); label.className = 'page-label'; label.textContent = '第 ' + (index + 1) + ' 页 · PDF'
  const frame = document.createElement('iframe'); frame.className = 'pdf-viewer'; frame.src = URL.createObjectURL(blob); frame.title = page.name
  state.objectUrls.push(frame.src); stage.append(label, frame); els.host.append(stage)
}
function createAlphaTabApi(host, kind, token) {
  if (!alphaTab?.AlphaTabApi) throw new Error('当前页面未加载 alphaTab，请使用 npm run dev 或 APK')
  const api = new alphaTab.AlphaTabApi(host, {
    core: { engine: 'svg', scriptFile: assetUrl('alphatab/alphaTab.min.js'), fontDirectory: assetUrl('font/') },
    display: { scale: isMobile ? 0.86 : 1.05, staveProfile: kind === 'musicxml' ? 'default' : 'tab', layoutMode: 'page' },
    player: { enablePlayer: true, soundFont: assetUrl('soundfont/sonivox.sf2') },
  })
  api.renderFinished.on(() => { if (token !== state.renderToken) return; state.hasVector = true; state.ready = true; els.player.hidden = false; setStatus('真实谱面已渲染 · ' + currentSong().pages.length + ' 个谱页') })
  api.error.on((error) => { if (token === state.renderToken) setStatus('谱面错误：' + (error.message || error), true) })
  api.playerStateChanged.on((event) => { if (token !== state.renderToken) return; state.playing = event.state === alphaTab.synth.PlayerState.Playing; els.play.classList.toggle('playing', state.playing); els.play.querySelector('span').textContent = state.playing ? 'Ⅱ' : '▶' })
  return api
}
async function appendVectorPage(page, blob, index, token) {
  const stage = document.createElement('section'); stage.className = 'score-page score-vector-page'; stage.dataset.pageId = page.id
  const label = document.createElement('div'); label.className = 'page-label'; label.textContent = page.type.toUpperCase() + ' · ' + (index + 1)
  const host = document.createElement('div'); host.className = 'vector-host'; stage.append(label, host); els.host.append(stage)
  const api = createAlphaTabApi(host, page.type, token); state.api = api; state.hasVector = true
  if (page.type === 'alphatex') {
    const text = page.text || (blob ? await blob.text() : DEFAULT_TEX); api.tex(text)
  } else if (blob) {
    api.load(new Uint8Array(await blob.arrayBuffer()))
  }
}
async function renderSong(song) {
  clearScore(); setTitle(song.title); setStatus('正在打开《' + song.title + '》…')
  const token = ++state.renderToken
  if (!song.pages.length) { setKind('image'); els.host.innerHTML = '<div class="empty-score"><strong>还没有谱页</strong><p>点击顶部“＋ 添加谱页”，一次选择多张图片。</p></div>'; return }
  for (let index = 0; index < song.pages.length; index += 1) {
    const page = song.pages[index]; const blob = page.blobId ? await readBlob(page.blobId) : null
    if (token !== state.renderToken) return
    if (page.type === 'image' && blob) appendImagePage(page, blob, index)
    else if (page.type === 'pdf' && blob) appendPdfPage(page, blob, index)
    else if (['gp', 'musicxml', 'alphatex'].includes(page.type)) await appendVectorPage(page, blob, index, token)
  }
  if (token === state.renderToken) {
    setKind(state.hasVector ? 'vector' : (song.pages[0]?.type || 'image')); setStatus(song.pages.length + ' 个谱页已打开')
    requestAnimationFrame(() => { els.scroll.scrollTop = Number(song.lastScrollTop) || 0; updateProgress() })
  }
}
function openImportPreview(files) {
  state.pendingFiles = files
  els.importCount.textContent = String(files.length)
  els.importFileList.innerHTML = files.map((file, index) => '<div class="import-file-row"><span>' + (index + 1) + '</span><strong>' + escapeHtml(file.name) + '</strong><small>' + Math.round(file.size / 1024) + ' KB</small></div>').join('')
  els.importModal.hidden = false
}
function closeImportPreview() { els.importModal.hidden = true; state.pendingFiles = [] }
async function createSongFromPendingFiles() {
  const files = state.pendingFiles.slice(); if (!files.length) return
  const title = stripExt(files[0].name) || '新曲目'
  const song = { id: uid('song'), title, note: '', lastPageId: null, lastScrollTop: 0, createdAt: Date.now(), updatedAt: Date.now(), pages: [] }
  state.songs = [song, ...state.songs]; state.currentSongId = song.id; saveSongs(); closeImportPreview(); renderLibrary(); await addFilesToCurrentSong(files)
}
async function addFilesToCurrentSong(files) {
  const song = currentSong(); const accepted = []
  for (const file of files) {
    const type = fileKind(file); if (!type) continue
    const page = { id: uid('page'), type, name: file.name, blobId: uid('blob') }
    if (type === 'alphatex') page.text = await file.text()
    await saveBlob(page.blobId, file); accepted.push(page)
  }
  if (!accepted.length) return setStatus('没有识别到支持的谱页格式', true)
  song.pages.push(...accepted); song.updatedAt = Date.now(); saveSongs(); renderLibrary(); await renderSong(song); setStatus(accepted.length + ' 个谱页已添加到《' + song.title + '》')
}
function renderLibrary() {
  const current = currentSong()
  const query = state.libraryQuery.trim().toLowerCase()
  let songs = state.songs.filter((song) => !query || song.title.toLowerCase().includes(query))
  if (state.libraryFilter === 'favorite') songs = songs.filter((song) => song.favorite)
  if (state.libraryFilter === 'recent') songs = songs.sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0)).slice(0, 12)
  els.libraryList.innerHTML = songs.map((song) => '<button class="library-item ' + (song.id === current.id ? 'active' : '') + '" data-song-id="' + song.id + '"><span class="library-icon">' + (song.favorite ? '★' : '🎼') + '</span><span class="library-copy"><strong>' + escapeHtml(song.title) + '</strong><small>' + song.pages.length + ' 个谱页 · ' + new Date(song.lastOpenedAt || song.updatedAt).toLocaleDateString('zh-CN') + '</small></span><span class="library-arrow">›</span></button>').join('') || '<div class="library-empty">没有找到曲目</div>'
  els.libraryList.querySelectorAll('[data-song-id]').forEach((button) => button.addEventListener('click', async () => { const song = state.songs.find((item) => item.id === button.dataset.songId); if (!song) return; setSong(song); closeLibrary(); await renderSong(song) }))
  els.pageManager.innerHTML = '<div class="page-manager-head"><strong>《' + escapeHtml(current.title) + '》的谱页</strong><span>' + current.pages.length + ' 页 <button data-favorite-song aria-label="收藏当前曲目">' + (current.favorite ? '★' : '☆') + '</button></span></div>' + current.pages.map((page, index) => '<div class="page-manager-item"><span class="page-manager-index">' + (index + 1) + '</span><span class="page-manager-name">' + escapeHtml(page.name || page.type.toUpperCase()) + '</span><button data-page-up="' + page.id + '" aria-label="上移谱页">↑</button><button data-page-down="' + page.id + '" aria-label="下移谱页">↓</button><button data-page-remove="' + page.id + '" aria-label="删除谱页">×</button></div>').join('')
  els.pageManager.querySelectorAll('[data-page-up]').forEach((button) => button.addEventListener('click', () => movePage(button.dataset.pageUp, -1)))
  els.pageManager.querySelectorAll('[data-page-down]').forEach((button) => button.addEventListener('click', () => movePage(button.dataset.pageDown, 1)))
  els.pageManager.querySelectorAll('[data-page-remove]').forEach((button) => button.addEventListener('click', () => removePage(button.dataset.pageRemove)))
  els.pageManager.querySelector('[data-favorite-song]')?.addEventListener('click', () => { current.favorite = !current.favorite; saveSongs(); renderLibrary() })
  els.library.querySelectorAll('[data-library-filter]').forEach((button) => button.classList.toggle('active', button.dataset.libraryFilter === state.libraryFilter))
}
function movePage(pageId, delta) { const song = currentSong(); const index = song.pages.findIndex((page) => page.id === pageId); const next = index + delta; if (index < 0 || next < 0 || next >= song.pages.length) return; [song.pages[index], song.pages[next]] = [song.pages[next], song.pages[index]]; song.updatedAt = Date.now(); saveSongs(); renderLibrary(); renderSong(song) }
function removePage(pageId) { const song = currentSong(); if (song.pages.length <= 1) return setStatus('至少保留一页谱面', true); const page = song.pages.find((item) => item.id === pageId); if (!page || !window.confirm('删除这张谱页？')) return; song.pages = song.pages.filter((item) => item.id !== pageId); song.updatedAt = Date.now(); saveSongs(); renderLibrary(); renderSong(song) }
function openRenameSong() { const song = currentSong(); state.songModalMode = 'rename'; els.songModalTitle.textContent = '重命名曲目'; els.songModalHint.textContent = '只修改曲目名称，谱页和笔记会保留。'; els.newSongName.value = song.title; els.newSongModal.hidden = false; requestAnimationFrame(() => { els.newSongName.focus(); els.newSongName.select() }) }
function setImmersive(enabled) { state.immersive = enabled; document.documentElement.classList.toggle('immersive-mode', enabled); els.immersive.textContent = enabled ? '退出沉浸模式' : '沉浸模式' }
async function toggleWakeLock() {
  if (state.wakeLock) { await state.wakeLock.release(); state.wakeLock = null; state.keepAwake = false; els.wakeLock.textContent = '保持屏幕常亮'; setStatus('已关闭屏幕常亮'); return }
  if (!('wakeLock' in navigator)) return setStatus('当前设备不支持屏幕常亮', true)
  try { state.wakeLock = await navigator.wakeLock.request('screen'); state.keepAwake = true; els.wakeLock.textContent = '关闭屏幕常亮'; setStatus('屏幕将保持常亮') } catch (error) { setStatus('无法开启屏幕常亮：' + error.message, true) }
}
async function exportZip() {
  const song = currentSong()
  if (!window.fflate?.zipSync) return setStatus('备份组件未加载', true)
  const files = { 'song.json': new TextEncoder().encode(JSON.stringify({ ...song, pages: song.pages.map(({ blobId, text, ...page }) => ({ ...page, blobId, text })) }, null, 2)), 'notes.txt': new TextEncoder().encode(song.note || '') }
  for (let index = 0; index < song.pages.length; index += 1) { const page = song.pages[index]; const blob = page.blobId ? await readBlob(page.blobId) : null; if (blob) files['pages/' + String(index + 1).padStart(3, '0') + '-' + page.name] = new Uint8Array(await blob.arrayBuffer()) }
  const zipped = window.fflate.zipSync(files, { level: 6 }); const url = URL.createObjectURL(new Blob([zipped], { type: 'application/zip' })); const link = document.createElement('a'); link.href = url; link.download = song.title + '-备份.zip'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('曲目备份已导出')
}
function openLibrary() { closeNotes(); renderLibrary(); els.library.classList.add('open'); els.library.setAttribute('aria-hidden', 'false'); els.scrim.hidden = false }
function closeLibrary() { els.library.classList.remove('open'); els.library.setAttribute('aria-hidden', 'true'); if (!els.noteDrawer.classList.contains('open')) els.scrim.hidden = true }
function openNotes() { closeLibrary(); els.noteDrawer.classList.add('open'); els.noteDrawer.setAttribute('aria-hidden', 'false'); els.scrim.hidden = false; els.noteEditor.focus({ preventScroll: true }) }
function closeNotes() { els.noteDrawer.classList.remove('open'); els.noteDrawer.setAttribute('aria-hidden', 'true'); if (!els.library.classList.contains('open')) els.scrim.hidden = true }
function openNewSong() { closeLibrary(); state.songModalMode = 'create'; els.songModalTitle.textContent = '新建曲子'; els.songModalHint.textContent = '新曲目会先带一份可直接查看的六线谱模板，之后可以继续添加多张谱页。'; els.newSongModal.hidden = false; els.newSongName.value = ''; requestAnimationFrame(() => els.newSongName.focus()) }
function closeNewSong() { els.newSongModal.hidden = true }
async function createNewSong() {
  const title = els.newSongName.value.trim() || '我的新曲子'
  if (state.songModalMode === 'rename') { const song = currentSong(); song.title = title; song.updatedAt = Date.now(); saveSongs(); setTitle(title); closeNewSong(); renderLibrary(); setStatus('曲目已重命名'); state.songModalMode = 'create'; return }
  const text = DEFAULT_TEX.replace("\\title 'Californian Evening'", "\\title '" + title.replace(/'/g, "\\'") + "'")
  const page = { id: uid('page'), type: 'alphatex', name: '默认六线谱', blobId: uid('blob'), text }
  await saveBlob(page.blobId, new File([text], title + '.atex', { type: 'text/x-alphatex' }))
  const song = { id: uid('song'), title, note: '', createdAt: Date.now(), updatedAt: Date.now(), pages: [page] }
  state.songs = [song, ...state.songs]; state.currentSongId = song.id; saveSongs(); closeNewSong(); renderLibrary(); await renderSong(song); setStatus('曲目《' + title + '》已创建'); state.songModalMode = 'create'
}
function saveNote() { const song = currentSong(); song.note = els.noteEditor.value; song.updatedAt = Date.now(); saveSongs(); document.querySelector('#noteSaved').textContent = '已保存'; clearTimeout(saveNote.timer); saveNote.timer = setTimeout(() => { document.querySelector('#noteSaved').textContent = '自动保存' }, 900) }
function restoreLastPosition() { const song = currentSong(); const target = song.lastPageId && els.host.querySelector('[data-page-id="' + song.lastPageId + '"]'); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); else els.scroll.scrollTo({ top: song.lastScrollTop || 0, behavior: 'smooth' }); closeNotes() }
function setBpm(value) { state.bpm = Math.max(40, Math.min(220, value)); els.bpm.textContent = state.bpm + ' BPM'; if (state.api) state.api.playbackSpeed = state.bpm / 90 }

document.querySelector('#importButton').addEventListener('click', () => els.file.click())
els.file.addEventListener('change', (event) => { const files = Array.from(event.target.files || []); event.target.value = ''; if (files.length) openImportPreview(files) })
document.querySelector('#libraryButton').addEventListener('click', openLibrary)
document.querySelector('#closeLibrary').addEventListener('click', closeLibrary)
document.querySelector('#newSongButton').addEventListener('click', openNewSong)
els.librarySearch.addEventListener('input', () => { state.libraryQuery = els.librarySearch.value; renderLibrary() })
els.library.querySelectorAll('[data-library-filter]').forEach((button) => button.addEventListener('click', () => { state.libraryFilter = button.dataset.libraryFilter; renderLibrary() }))
els.renameSong.addEventListener('click', openRenameSong)
els.exportZip.addEventListener('click', exportZip)
els.wakeLock.addEventListener('click', toggleWakeLock)
els.immersive.addEventListener('click', () => setImmersive(!state.immersive))
document.querySelector('#cancelNewSong').addEventListener('click', closeNewSong)
document.querySelector('#cancelNewSongBottom').addEventListener('click', closeNewSong)
document.querySelector('#createNewSong').addEventListener('click', createNewSong)
document.querySelector('#cancelImport').addEventListener('click', closeImportPreview)
document.querySelector('#importIntoCurrent').addEventListener('click', async () => { const files = state.pendingFiles.slice(); closeImportPreview(); await addFilesToCurrentSong(files) })
document.querySelector('#importAsNew').addEventListener('click', createSongFromPendingFiles)
els.newSongName.addEventListener('keydown', (event) => { if (event.key === 'Enter') createNewSong() })
document.querySelector('#noteFab').addEventListener('click', openNotes)
document.querySelector('#drawerScrim').addEventListener('click', () => { closeLibrary(); closeNotes() })
document.querySelector('#playButton').addEventListener('click', () => state.api?.playPause())
document.querySelector('#bpmDown').addEventListener('click', () => setBpm(state.bpm - 5))
document.querySelector('#bpmUp').addEventListener('click', () => setBpm(state.bpm + 5))
document.querySelector('#restorePositionButton').addEventListener('click', restoreLastPosition)
els.scroll.addEventListener('scroll', updateProgress, { passive: true })
els.noteEditor.addEventListener('input', saveNote)
let noteStartY = 0
els.noteDrawer.addEventListener('touchstart', (event) => { noteStartY = event.touches[0]?.clientY || 0 }, { passive: true })
els.noteDrawer.addEventListener('touchend', (event) => { const endY = event.changedTouches[0]?.clientY || noteStartY; if (endY - noteStartY > 60) closeNotes() }, { passive: true })
document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible' && state.keepAwake && !state.wakeLock) { try { state.wakeLock = await navigator.wakeLock.request('screen') } catch {} } })
const syncOrientation = () => document.documentElement.classList.toggle('landscape-mode', window.innerWidth > window.innerHeight && window.innerHeight < 620)
window.addEventListener('resize', syncOrientation)
syncOrientation()

saveSongs()
renderLibrary()
setSong(currentSong())
renderSong(currentSong())

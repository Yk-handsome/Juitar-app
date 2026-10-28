const VERSION = '0.2.0'
const alphaTab = window.alphaTab
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth <= 760
const assetUrl = (path) => new URL(path, document.baseURI).href
const SONGS_KEY = 'juitar:songs:v3'
const CURRENT_SONG_KEY = 'juitar:current-song:v3'
const TRASH_KEY = 'juitar:trash:v1'
const DATA_VERSION_KEY = 'juitar:data-version'
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
  thumbnailUrls: [],
  pinch: { active: false, distance: 0, scale: 1 },
  scrollSaveTimer: 0,
  pendingFiles: [],
  libraryQuery: '',
  libraryFilter: 'all',
  songModalMode: 'create',
  wakeLock: null,
  keepAwake: false,
  immersive: false,
  trash: JSON.parse(localStorage.getItem(TRASH_KEY) || '[]').filter((item) => Date.now() - Number(item.deletedAt || 0) < 30 * 24 * 60 * 60 * 1000),
  pdfjsPromise: null,
}

if (!state.currentSongId || !state.songs.some((song) => song.id === state.currentSongId)) state.currentSongId = state.songs[0].id

const app = document.querySelector('#app')
app.innerHTML = '\
  <header class="topbar">\
    <button class="icon-button" id="libraryButton" aria-label="打开谱夹">📁 <span>谱夹</span></button>\
    <div class="current-title" id="songTitle"></div>\
    <button class="import-button" id="importButton">＋ 添加谱页</button>\
    <input id="fileInput" type="file" hidden multiple accept=".jpg,.jpeg,.png,.pdf,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml,.atex,image/jpeg,image/png,application/pdf,application/octet-stream,application/xml,text/xml,text/x-alphatex" /><input id="zipInput" type="file" hidden accept=".zip,application/zip" />\
  </header>\
  <main class="score-main"><div class="score-scroll" id="scoreScroll"><div class="score-host" id="scoreHost" aria-live="polite"></div></div></main>\
  <div class="score-status" id="scoreStatus"></div><div class="score-progress" id="scoreProgress">第 1 / 1 页</div>\
  <nav class="landscape-nav" id="landscapeNav" aria-label="横屏翻页"><button id="prevPage" aria-label="上一页">‹</button><span id="landscapePage">1 / 1</span><button id="nextPage" aria-label="下一页">›</button></nav>\
  <div class="float-player" id="floatPlayer" hidden>\
    <button id="playButton" aria-label="播放或暂停"><span>▶</span></button><button id="bpmDown" aria-label="降低 BPM">−5</button><strong id="bpmValue">90 BPM</strong><button id="bpmUp" aria-label="提高 BPM">＋5</button>\
  </div>\
  <button class="note-fab" id="noteFab" aria-label="打开笔记">📝</button>\
  <div class="drawer-scrim" id="drawerScrim" hidden></div>\
  <aside class="library-drawer" id="libraryDrawer" aria-hidden="true"><div class="drawer-head"><strong>我的谱夹</strong><button class="close-button" id="closeLibrary" aria-label="关闭">×</button></div><button class="new-song-button" id="newSongButton">＋ 新建曲子</button><section class="recent-strip" id="recentStrip"></section><div class="library-tools"><input id="librarySearch" type="search" placeholder="搜索曲目" /><button data-library-filter="all" class="active">全部</button><button data-library-filter="recent">最近</button><button data-library-filter="favorite">收藏</button></div><p class="drawer-hint">选择曲目继续阅读，也可以在下面管理当前曲目。</p><div class="library-list" id="libraryList"></div><section class="page-manager" id="pageManager"></section><section class="library-actions"><button id="renameSongButton">重命名当前曲目</button><button id="deleteSongButton">删除当前曲目</button><button id="exportZipButton">导出曲目备份</button><button id="importZipButton">导入曲目备份</button><button id="recentDeleteButton">最近删除</button><button id="wakeLockButton">保持屏幕常亮</button><button id="immersiveButton">沉浸模式</button></section><section class="trash-panel" id="trashPanel" hidden></section></aside>\
  <aside class="note-drawer" id="noteDrawer" aria-hidden="true"><div class="drawer-handle"></div><div class="note-head"><strong>《<span id="noteSongTitle"></span>》笔记</strong><span id="noteSaved">自动保存</span></div><textarea id="noteEditor" placeholder="写下练习感受、指法、难点或下次要注意的地方…"></textarea><div class="note-footer"><button class="note-anchor" id="restorePositionButton">回到上次阅读位置</button><span>点击遮罩或下滑收起</span></div></aside>\
  <div class="import-modal" id="importModal" hidden><div class="import-card"><div class="new-song-head"><strong>导入谱页</strong><button class="close-button" id="cancelImport" aria-label="关闭">×</button></div><p>已选择 <span id="importCount">0</span> 个文件。请选择放入位置。</p><div class="import-file-list" id="importFileList"></div><div class="new-song-actions"><button class="secondary-button" id="importAsNew">新建曲目并加入</button><button class="primary-button" id="importIntoCurrent">加入当前曲目</button></div></div></div>\
  <div class="new-song-modal" id="newSongModal" hidden><div class="new-song-card"><div class="new-song-head"><strong id="songModalTitle">新建曲子</strong><button class="close-button" id="cancelNewSong" aria-label="关闭">×</button></div><p id="songModalHint">新曲目会先带一份可直接查看的六线谱模板，之后可以继续添加多张谱页。</p><label for="newSongName">曲名</label><input id="newSongName" type="text" maxlength="80" placeholder="例如：Hotel California" /><div class="new-song-actions"><button class="secondary-button" id="cancelNewSongBottom">取消</button><button class="primary-button" id="createNewSong">创建并打开</button></div></div></div>'

const els = {
  title: document.querySelector('#songTitle'), noteTitle: document.querySelector('#noteSongTitle'), host: document.querySelector('#scoreHost'),
  scroll: document.querySelector('#scoreScroll'), status: document.querySelector('#scoreStatus'), file: document.querySelector('#fileInput'),
  player: document.querySelector('#floatPlayer'), play: document.querySelector('#playButton'), bpm: document.querySelector('#bpmValue'), progress: document.querySelector('#scoreProgress'), landscapePage: document.querySelector('#landscapePage'),
  library: document.querySelector('#libraryDrawer'), libraryList: document.querySelector('#libraryList'), recentStrip: document.querySelector('#recentStrip'), scrim: document.querySelector('#drawerScrim'),
  noteDrawer: document.querySelector('#noteDrawer'), noteEditor: document.querySelector('#noteEditor'), noteSaved: document.querySelector('#noteSaved'),
  newSongModal: document.querySelector('#newSongModal'), newSongName: document.querySelector('#newSongName'), songModalTitle: document.querySelector('#songModalTitle'), songModalHint: document.querySelector('#songModalHint'), pageManager: document.querySelector('#pageManager'), trashPanel: document.querySelector('#trashPanel'), importModal: document.querySelector('#importModal'), importFileList: document.querySelector('#importFileList'), importCount: document.querySelector('#importCount'), librarySearch: document.querySelector('#librarySearch'), renameSong: document.querySelector('#renameSongButton'), deleteSong: document.querySelector('#deleteSongButton'), exportZip: document.querySelector('#exportZipButton'), importZip: document.querySelector('#importZipButton'), recentDelete: document.querySelector('#recentDeleteButton'), zipFile: document.querySelector('#zipInput'), wakeLock: document.querySelector('#wakeLockButton'), immersive: document.querySelector('#immersiveButton'),
}

function currentSong() { return state.songs.find((song) => song.id === state.currentSongId) || state.songs[0] }
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]) }
function saveSongs() { localStorage.setItem(SONGS_KEY, JSON.stringify(state.songs)); localStorage.setItem(CURRENT_SONG_KEY, state.currentSongId); localStorage.setItem(TRASH_KEY, JSON.stringify(state.trash)); localStorage.setItem(DATA_VERSION_KEY, '2') }
function setStatus(text, error = false) { els.status.textContent = text; els.status.classList.toggle('error', error); els.status.classList.toggle('visible', Boolean(text)); clearTimeout(setStatus.timer); if (!error && text.includes('已')) setStatus.timer = setTimeout(() => els.status.classList.remove('visible'), 1800) }
function setTitle(title) { els.title.textContent = title; els.title.title = title; els.noteTitle.textContent = title; document.title = 'Juitar · ' + title }
function setKind(kind) { state.kind = kind; els.player.hidden = !state.hasVector }
function revokeObjectUrls() { state.objectUrls.forEach((url) => URL.revokeObjectURL(url)); state.objectUrls = [] }
function revokeThumbnailUrls() { state.thumbnailUrls.forEach((url) => URL.revokeObjectURL(url)); state.thumbnailUrls = [] }
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
async function fileHash(file) {
  if (!crypto?.subtle) return file.name + ':' + file.size
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
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
  els.landscapePage.textContent = (index + 1) + ' / ' + pages.length
  clearTimeout(state.scrollSaveTimer)
  state.scrollSaveTimer = setTimeout(saveSongs, 350)
}
function goToPage(delta) {
  const pages = Array.from(els.host.querySelectorAll('.score-page')); if (!pages.length) return
  const currentIndex = Math.max(0, pages.findIndex((page) => page.dataset.pageId === currentSong().lastPageId))
  const target = pages[Math.min(pages.length - 1, Math.max(0, currentIndex + delta))]
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function jumpToPage(pageId) { const target = els.host.querySelector('[data-page-id="' + pageId + '"]'); if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); currentSong().lastPageId = pageId; saveSongs(); updateProgress() } }
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
async function appendPdfPage(page, blob, index) {
  const stage = document.createElement('section'); stage.className = 'score-page pdf-stage'; stage.dataset.pageId = page.id
  const label = document.createElement('div'); label.className = 'page-label'; label.textContent = '第 ' + (index + 1) + ' 页 · PDF'
  stage.append(label); els.host.append(stage)
  if (!state.pdfjsPromise) state.pdfjsPromise = window.pdfjsReady || new Promise((resolve) => window.addEventListener('pdfjs-ready', () => resolve(window.pdfjsReady), { once: true }))
  const pdfjs = await state.pdfjsPromise
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const pdfPage = await pdf.getPage(pageNumber); const base = pdfPage.getViewport({ scale: 1 }); const scale = Math.max(1, (els.scroll.clientWidth - 8) / base.width); const viewport = pdfPage.getViewport({ scale })
    const canvas = document.createElement('canvas'); canvas.className = 'pdf-canvas'; canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height); canvas.setAttribute('aria-label', page.name + ' 第 ' + pageNumber + ' 页')
    stage.append(canvas); await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  }
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
    else if (page.type === 'pdf' && blob) await appendPdfPage(page, blob, index)
    else if (['gp', 'musicxml', 'alphatex'].includes(page.type)) await appendVectorPage(page, blob, index, token)
  }
  if (token === state.renderToken) {
    setKind(state.hasVector ? 'vector' : (song.pages[0]?.type || 'image')); setStatus(song.pages.length + ' 个谱页已打开')
    requestAnimationFrame(() => { els.scroll.scrollTop = Number(song.lastScrollTop) || 0; updateProgress() })
  }
}
function openImportPreview(files) {
  state.pendingFiles = [...files].sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }))
  els.importCount.textContent = String(state.pendingFiles.length)
  els.importFileList.innerHTML = '<div class="import-sort-hint">已按文件名中的数字自动排序</div>' + state.pendingFiles.map((file, index) => '<div class="import-file-row"><span>' + (index + 1) + '</span><strong>' + escapeHtml(file.name) + '</strong><small>' + Math.round(file.size / 1024) + ' KB</small></div>').join('')
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
  const song = currentSong(); const accepted = []; let duplicates = 0
  for (const file of files) {
    const type = fileKind(file); if (!type) continue
    const hash = await fileHash(file)
    if (song.pages.some((page) => page.hash && page.hash === hash)) { duplicates += 1; continue }
    const page = { id: uid('page'), type, name: file.name, hash, blobId: uid('blob') }
    if (type === 'alphatex') page.text = await file.text()
    await saveBlob(page.blobId, file); accepted.push(page)
  }
  if (!accepted.length) return setStatus(duplicates ? '这些谱页已经存在，未重复添加' : '没有识别到支持的谱页格式', true)
  song.pages.push(...accepted); song.updatedAt = Date.now(); saveSongs(); renderLibrary(); await renderSong(song); setStatus(accepted.length + ' 个谱页已添加到《' + song.title + '》' + (duplicates ? '，跳过 ' + duplicates + ' 个重复文件' : ''))
}
function renderLibrary() {
  const current = currentSong()
  const recentSongs = [...state.songs].sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0)).slice(0, 3)
  els.recentStrip.innerHTML = '<div class="recent-strip-head"><strong>最近打开</strong><span>' + recentSongs.length + ' 首</span></div><div class="recent-strip-list">' + recentSongs.map((song) => '<button class="recent-card ' + (song.id === current.id ? 'active' : '') + '" data-recent-song="' + song.id + '"><span class="recent-card-icon">' + (song.favorite ? '★' : '🎼') + '</span><strong>' + escapeHtml(song.title) + '</strong><small>' + song.pages.length + ' 页</small></button>').join('') + '</div>'
  els.recentStrip.querySelectorAll('[data-recent-song]').forEach((button) => button.addEventListener('click', async () => { const song = state.songs.find((item) => item.id === button.dataset.recentSong); if (!song) return; setSong(song); closeLibrary(); await renderSong(song) }))
  revokeThumbnailUrls()
  const query = state.libraryQuery.trim().toLowerCase()
  let songs = state.songs.filter((song) => !query || song.title.toLowerCase().includes(query))
  if (state.libraryFilter === 'favorite') songs = songs.filter((song) => song.favorite)
  if (state.libraryFilter === 'recent') songs = songs.sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0)).slice(0, 12)
  els.libraryList.innerHTML = songs.map((song) => '<button class="library-item ' + (song.id === current.id ? 'active' : '') + '" data-song-id="' + song.id + '"><span class="library-thumb" data-song-thumb="' + song.id + '"><span>' + (song.favorite ? '★' : '🎼') + '</span></span><span class="library-copy"><strong>' + escapeHtml(song.title) + '</strong><small>' + song.pages.length + ' 个谱页 · ' + new Date(song.lastOpenedAt || song.updatedAt).toLocaleDateString('zh-CN') + '</small></span><span class="library-arrow">›</span></button>').join('') || '<div class="library-empty">没有找到曲目</div>'
  els.libraryList.querySelectorAll('[data-song-id]').forEach((button) => button.addEventListener('click', async () => { const song = state.songs.find((item) => item.id === button.dataset.songId); if (!song) return; setSong(song); closeLibrary(); await renderSong(song) }))
  els.pageManager.innerHTML = '<div class="page-manager-head"><strong>《' + escapeHtml(current.title) + '》的谱页</strong><span>' + current.pages.length + ' 页 <button data-favorite-song aria-label="收藏当前曲目">' + (current.favorite ? '★' : '☆') + '</button></span></div>' + current.pages.map((page, index) => '<div class="page-manager-item" data-page-jump="' + page.id + '"><span class="page-thumb" data-page-thumb="' + page.id + '"></span><span class="page-manager-index">' + (index + 1) + '</span><span class="page-manager-name">' + escapeHtml(page.name || page.type.toUpperCase()) + '</span><button data-page-up="' + page.id + '" aria-label="上移谱页">↑</button><button data-page-down="' + page.id + '" aria-label="下移谱页">↓</button><button data-page-remove="' + page.id + '" aria-label="删除谱页">×</button></div>').join('')
  els.pageManager.querySelectorAll('[data-page-up]').forEach((button) => button.addEventListener('click', () => movePage(button.dataset.pageUp, -1)))
  els.pageManager.querySelectorAll('[data-page-down]').forEach((button) => button.addEventListener('click', () => movePage(button.dataset.pageDown, 1)))
  els.pageManager.querySelectorAll('[data-page-remove]').forEach((button) => button.addEventListener('click', () => removePage(button.dataset.pageRemove)))
  els.pageManager.querySelectorAll('[data-page-jump]').forEach((item) => item.addEventListener('click', (event) => { if (!event.target.closest('button')) jumpToPage(item.dataset.pageJump) }))
  els.pageManager.querySelector('[data-favorite-song]')?.addEventListener('click', () => { current.favorite = !current.favorite; saveSongs(); renderLibrary() })
  els.library.querySelectorAll('[data-library-filter]').forEach((button) => button.classList.toggle('active', button.dataset.libraryFilter === state.libraryFilter))
  renderTrash()
  hydrateThumbnails(songs, current)
}
async function hydrateThumbnails(songs, current) {
  const thumbPages = []
  for (const song of songs) { const page = song.pages.find((entry) => entry.type === 'image' && entry.blobId); if (page) thumbPages.push({ target: els.libraryList.querySelector('[data-song-thumb="' + song.id + '"]'), page }) }
  for (const { target, page } of thumbPages) { if (!target) continue; const blob = await readBlob(page.blobId); if (!blob) continue; const url = URL.createObjectURL(blob); state.thumbnailUrls.push(url); target.style.backgroundImage = 'url("' + url + '")'; target.classList.add('has-image') }
  for (const page of current.pages.filter((entry) => entry.type === 'image' && entry.blobId)) { const target = els.pageManager.querySelector('[data-page-thumb="' + page.id + '"]'); if (!target) continue; const blob = await readBlob(page.blobId); if (!blob) continue; const url = URL.createObjectURL(blob); state.thumbnailUrls.push(url); target.style.backgroundImage = 'url("' + url + '")'; target.classList.add('has-image') }
}
function movePage(pageId, delta) { const song = currentSong(); const index = song.pages.findIndex((page) => page.id === pageId); const next = index + delta; if (index < 0 || next < 0 || next >= song.pages.length) return; [song.pages[index], song.pages[next]] = [song.pages[next], song.pages[index]]; song.updatedAt = Date.now(); saveSongs(); renderLibrary(); renderSong(song) }
function removePage(pageId) { const song = currentSong(); if (song.pages.length <= 1) return setStatus('至少保留一页谱面', true); const index = song.pages.findIndex((item) => item.id === pageId); const page = song.pages[index]; if (!page || !window.confirm('移到最近删除？')) return; song.pages.splice(index, 1); state.trash.unshift({ id: uid('trash'), kind: 'page', songId: song.id, page, index, deletedAt: Date.now() }); song.updatedAt = Date.now(); saveSongs(); renderLibrary(); renderSong(song); setStatus('谱页已移到最近删除') }
function deleteCurrentSong() {
  const song = currentSong(); if (state.songs.length <= 1) return setStatus('至少保留一首曲目', true)
  if (!window.confirm('移到最近删除？')) return
  state.trash.unshift({ id: uid('trash'), kind: 'song', song: { ...song, pages: song.pages.map((page) => ({ ...page })) }, deletedAt: Date.now() })
  state.songs = state.songs.filter((item) => item.id !== song.id); state.currentSongId = state.songs[0].id; saveSongs(); renderLibrary(); renderSong(currentSong()); setStatus('曲目已移到最近删除')
}
function renderTrash() {
  if (!state.trash.length) { els.trashPanel.innerHTML = '<div class="trash-empty">最近删除为空</div>'; return }
  els.trashPanel.innerHTML = '<div class="trash-head"><strong>最近删除</strong><button id="closeTrash">收起</button></div>' + state.trash.map((item) => '<div class="trash-item"><span>' + (item.kind === 'page' ? '谱页' : '曲目') + '</span><strong>' + escapeHtml(item.page?.name || item.song?.title || '未命名') + '</strong><button data-restore="' + item.id + '">恢复</button></div>').join('')
  els.trashPanel.querySelector('#closeTrash')?.addEventListener('click', () => { els.trashPanel.hidden = true })
  els.trashPanel.querySelectorAll('[data-restore]').forEach((button) => button.addEventListener('click', () => restoreTrash(button.dataset.restore)))
}
function restoreTrash(id) {
  const item = state.trash.find((entry) => entry.id === id); if (!item) return
  if (item.kind === 'page') { const song = state.songs.find((entry) => entry.id === item.songId); if (song) song.pages.splice(Math.min(item.index, song.pages.length), 0, item.page) }
  if (item.kind === 'song' && item.song) state.songs.unshift(item.song)
  state.trash = state.trash.filter((entry) => entry.id !== id); saveSongs(); renderLibrary(); renderTrash(); renderSong(currentSong()); setStatus('已恢复')
}
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
  const files = { 'manifest.json': new TextEncoder().encode(JSON.stringify({ app: 'Juitar', schemaVersion: 1, exportedAt: new Date().toISOString() }, null, 2)), 'song.json': new TextEncoder().encode(JSON.stringify({ ...song, pages: song.pages.map(({ blobId, text, ...page }) => ({ ...page, blobId, text })) }, null, 2)), 'notes.txt': new TextEncoder().encode(song.note || '') }
  for (let index = 0; index < song.pages.length; index += 1) { const page = song.pages[index]; const blob = page.blobId ? await readBlob(page.blobId) : null; if (blob) files['pages/' + String(index + 1).padStart(3, '0') + '-' + page.name.replace(/[\\\\/]/g, '_')] = new Uint8Array(await blob.arrayBuffer()) }
  const zipped = window.fflate.zipSync(files, { level: 6 }); const url = URL.createObjectURL(new Blob([zipped], { type: 'application/zip' })); const link = document.createElement('a'); link.href = url; link.download = song.title + '-备份.zip'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('曲目备份已导出')
}
async function importZipFile(file) {
  if (!window.fflate?.unzipSync) return setStatus('备份组件未加载', true)
  try {
    const files = window.fflate.unzipSync(new Uint8Array(await file.arrayBuffer()))
    const decoder = new TextDecoder()
    if (!files['manifest.json'] || !files['song.json']) throw new Error('不是 Juitar 备份文件')
    const manifest = JSON.parse(decoder.decode(files['manifest.json']))
    if (manifest.app !== 'Juitar' || Number(manifest.schemaVersion) > 1) throw new Error('备份版本不兼容')
    const songData = JSON.parse(decoder.decode(files['song.json']))
    if (!songData.title || !Array.isArray(songData.pages)) throw new Error('备份曲目结构无效')
    const baseTitle = songData.title + '（恢复）'; let restoredTitle = baseTitle; let suffix = 2
    while (state.songs.some((song) => song.title === restoredTitle)) restoredTitle = baseTitle + ' ' + suffix++
    const imported = { ...songData, id: uid('song'), title: restoredTitle, lastPageId: null, lastScrollTop: 0, lastOpenedAt: Date.now(), updatedAt: Date.now(), pages: [] }
    for (let index = 0; index < (songData.pages || []).length; index += 1) {
      const source = songData.pages[index]; const page = { ...source, id: uid('page') }
      const prefix = 'pages/' + String(index + 1).padStart(3, '0') + '-'
      const path = Object.keys(files).find((name) => name.startsWith(prefix))
      if (path) { page.blobId = uid('blob'); const mime = page.type === 'image' ? 'image/' + (page.name.toLowerCase().endsWith('.png') ? 'png' : 'jpeg') : page.type === 'pdf' ? 'application/pdf' : 'application/octet-stream'; await saveBlob(page.blobId, new File([files[path]], page.name, { type: mime })) }
      imported.pages.push(page)
    }
    state.songs = [imported, ...state.songs]; state.currentSongId = imported.id; saveSongs(); renderLibrary(); closeLibrary(); await renderSong(imported); setStatus('备份已恢复为《' + imported.title + '》')
  } catch (error) { setStatus('备份恢复失败：' + error.message, true) }
}
function openLibrary() { closeNotes(); renderLibrary(); els.library.classList.add('open'); els.library.setAttribute('aria-hidden', 'false'); els.scrim.hidden = false }
function closeLibrary() { els.library.classList.remove('open'); els.library.setAttribute('aria-hidden', 'true'); if (!els.noteDrawer.classList.contains('open')) els.scrim.hidden = true }
function openNotes() { closeLibrary(); els.noteDrawer.classList.add('open'); els.noteDrawer.setAttribute('aria-hidden', 'false'); els.scrim.hidden = false; els.noteEditor.focus({ preventScroll: true }) }
function closeNotes() { els.noteDrawer.classList.remove('open'); els.noteDrawer.setAttribute('aria-hidden', 'true'); if (!els.library.classList.contains('open')) els.scrim.hidden = true }
function openNewSong() { closeLibrary(); state.songModalMode = 'create'; els.songModalTitle.textContent = '新建曲子'; els.songModalHint.textContent = '新曲目会先带一份可直接查看的六线谱模板，之后可以继续添加多张谱页。'; els.newSongModal.hidden = false; els.newSongName.value = ''; requestAnimationFrame(() => els.newSongName.focus()) }
function closeNewSong() { els.newSongModal.hidden = true }
window.handleAndroidBack = () => {
  if (!els.importModal.hidden) { closeImportPreview(); return true }
  if (!els.newSongModal.hidden) { closeNewSong(); return true }
  if (els.noteDrawer.classList.contains('open')) { closeNotes(); return true }
  if (els.library.classList.contains('open')) { closeLibrary(); return true }
  return false
}
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
els.deleteSong.addEventListener('click', deleteCurrentSong)
els.exportZip.addEventListener('click', exportZip)
els.importZip.addEventListener('click', () => els.zipFile.click())
els.zipFile.addEventListener('change', (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) importZipFile(file) })
els.recentDelete.addEventListener('click', () => { els.trashPanel.hidden = !els.trashPanel.hidden; if (!els.trashPanel.hidden) renderTrash() })
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
document.querySelector('#prevPage').addEventListener('click', () => goToPage(-1))
document.querySelector('#nextPage').addEventListener('click', () => goToPage(1))
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

function openIncomingAndroidFile() {
  if (!window.JuitarAndroid || !window.JuitarAndroid.incomingCount || window.JuitarAndroid.incomingCount() < 1) return
  try {
    const files = []
    for (let fileIndex = 0; fileIndex < window.JuitarAndroid.incomingCount(); fileIndex += 1) {
      const base64 = window.JuitarAndroid.incomingBase64At(fileIndex); const raw = atob(base64); const bytes = new Uint8Array(raw.length)
      for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
      files.push(new File([bytes], window.JuitarAndroid.incomingNameAt(fileIndex), { type: window.JuitarAndroid.incomingMimeAt(fileIndex) || 'application/octet-stream' }))
    }
    window.JuitarAndroid.consumeIncomingFile(); openImportPreview(files)
  } catch (error) { setStatus('无法打开系统分享的文件：' + error.message, true) }
}
window.addEventListener('android-incoming-file', openIncomingAndroidFile)
setTimeout(openIncomingAndroidFile, 300)


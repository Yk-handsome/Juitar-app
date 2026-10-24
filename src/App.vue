<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import TopBar from './components/TopBar.vue'
import ScoreView from './components/ScoreView.vue'
import NoteEditor from './components/NoteEditor.vue'
import SplitLayout from './components/SplitLayout.vue'
import { useAppStore } from './stores/appStore'
import { useLibraryStore } from './stores/libraryStore'
import { useScoreStore } from './stores/scoreStore'

const appStore = useAppStore()
const libraryStore = useLibraryStore()
const scoreStore = useScoreStore()
const splitRatio = ref(56)
const mobileView = ref<'score' | 'notes'>('score')
const libraryOpen = ref(false)
const isMobile = ref(false)
const selectedSong = computed(() => libraryStore.selectedSong)

function updateViewport() {
  isMobile.value = window.matchMedia('(max-width: 760px), (max-height: 500px) and (max-width: 1000px)').matches
}

function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const editing = target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT' || target?.isContentEditable
  if (editing && event.key !== 'Escape') return
  if (event.key === ' ') {
    event.preventDefault(); scoreStore.togglePlayback()
  } else if (event.key === '[') {
    event.preventDefault(); scoreStore.changeSpeed(-5)
  } else if (event.key === ']') {
    event.preventDefault(); scoreStore.changeSpeed(5)
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault(); scoreStore.resetLoop()
  }
}
onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  updateViewport()
  window.addEventListener('resize', updateViewport)
  await appStore.initialize()
  await libraryStore.loadVault(appStore.vaultPath)
  if (libraryStore.songs.length === 0) await libraryStore.createDemoVault()
  if (libraryStore.songs.length > 0) await libraryStore.selectSong(libraryStore.songs[0])
  const showcase = new URLSearchParams(window.location.search).get('showcase')
  if (showcase === 'library') libraryOpen.value = true
  if (showcase === 'notes') mobileView.value = 'notes'
  if (showcase === 'anchor') {
    scoreStore.setLoop(8, 12)
    scoreStore.jumpToMeasure(8, 12)
  }
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updateViewport)
})
</script>

<template>
  <main class="app-shell">
    <TopBar @toggle-library="libraryOpen = !libraryOpen" />
    <section class="library-strip" :class="{ 'is-open': libraryOpen }">
      <div class="library-title"><span class="brand-mark">♪</span><div><strong>Juitar</strong><span class="muted">个人练习工作台</span></div></div>
      <label class="search-box"><span>⌕</span><input v-model="libraryStore.query" placeholder="搜索歌曲、作者或标签" /></label>
      <div class="tag-list">
        <button class="tag-chip" :class="{ active: !libraryStore.activeTag }" @click="libraryStore.activeTag = ''">全部</button>
        <button v-for="tag in libraryStore.tags" :key="tag" class="tag-chip" :class="{ active: libraryStore.activeTag === tag }" @click="libraryStore.activeTag = tag">#{{ tag }}</button>
      </div>
      <button class="ghost-button" @click="libraryStore.createDemoVault(); libraryOpen = false">生成示例曲库</button>
    </section>
    <section class="song-row" :class="{ 'is-open': libraryOpen }">
      <button v-for="song in libraryStore.filteredSongs" :key="song.id" class="song-card" :class="{ selected: song.id === selectedSong?.id }" @click="libraryStore.selectSong(song)">
        <span class="song-card-icon">{{ song.scoreType === 'alphaTab' ? '♬' : '▧' }}</span>
        <span class="song-card-copy"><strong>{{ song.title }}</strong><small>{{ song.artist || '未填写作者' }}</small></span>
        <span class="song-card-meta">{{ song.defaultTempo }} BPM</span>
      </button>
      <span v-if="libraryStore.filteredSongs.length === 0" class="empty-inline">暂无曲目，点击“生成示例曲库”开始。</span>
    </section>
    <section class="mobile-tabs" v-if="isMobile" aria-label="练习工作区">
      <button :class="{ active: mobileView === 'score' }" @click="mobileView = 'score'">谱面 <span>⌁</span></button>
      <button :class="{ active: mobileView === 'notes' }" @click="mobileView = 'notes'">笔记 <span>✦</span></button>
    </section>
    <SplitLayout v-model:ratio="splitRatio" :class="{ 'mobile-score': isMobile && mobileView === 'score', 'mobile-notes': isMobile && mobileView === 'notes' }"><template #left><ScoreView /></template><template #right><NoteEditor /></template></SplitLayout>
    <nav v-if="isMobile" class="mobile-touchbar" aria-label="练习控制">
      <button class="touchbar-secondary" @click="scoreStore.resetLoop"><span>↺</span><small>回到循环</small></button>
      <button class="touchbar-play" :class="{ playing: scoreStore.isPlaying }" @click="scoreStore.togglePlayback"><span>{{ scoreStore.isPlaying ? 'Ⅱ' : '▶' }}</span></button>
      <button class="touchbar-secondary" @click="scoreStore.changeSpeed(-5)"><span>{{ scoreStore.speed }}%</span><small>速度</small></button>
      <button class="touchbar-secondary" @click="scoreStore.setLoop(scoreStore.currentMeasure, scoreStore.currentMeasure + 4)"><span>A—B</span><small>循环</small></button>
    </nav>
    <footer class="status-bar">
      <div class="status-group"><span class="status-dot" :class="{ ready: scoreStore.isReady }"></span><span>{{ scoreStore.isReady ? '谱面引擎已就绪' : '等待谱面' }}</span><span class="divider"></span><span>{{ selectedSong?.title || '未选择曲目' }}</span></div>
      <div class="status-group"><span>Vault: {{ appStore.vaultPath || '浏览器演示模式' }}</span><span class="divider"></span><span>{{ appStore.saveStatus }}</span></div>
    </footer>
  </main>
</template>

<script setup lang="ts">
import * as alphaTab from '@coderline/alphatab'
import { invoke } from '@tauri-apps/api/core'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useLibraryStore } from '../stores/libraryStore'
import { useScoreStore } from '../stores/scoreStore'

const libraryStore = useLibraryStore()
const scoreStore = useScoreStore()
const host = ref<HTMLElement | null>(null)
const api = ref<alphaTab.AlphaTabApi | null>(null)
const loadError = ref('')
const hasRealScore = ref(false)
const mute = ref(false)
const solo = ref(false)
const title = computed(() => libraryStore.selectedSong?.title || '尚未选择曲目')

function createApi() {
  if (!host.value || api.value) return
  try {
    api.value = new alphaTab.AlphaTabApi(host.value, {
      core: { engine: 'svg', fontDirectory: '/font/' },
      display: { scale: 1.05, staveProfile: 'scoretab' },
      player: { enablePlayer: true, soundFont: '/soundfont/sonivox.sf2' },
    })
    api.value.playerStateChanged.on((event) => scoreStore.setPlaying(event.state === alphaTab.synth.PlayerState.Playing))
    api.value.playerPositionChanged.on((event) => {
      if (event.endTick > 0) scoreStore.currentMeasure = Math.min(32, Math.max(1, Math.floor((event.currentTick / event.endTick) * 32) + 1))
    })
    api.value.postRenderFinished.on(() => scoreStore.setApi({ playPause: () => api.value?.playPause(), stop: () => api.value?.stop(), scrollToMeasure: (measure) => scrollToMeasure(measure) }))
    scoreStore.setApi({ playPause: () => api.value?.playPause(), stop: () => api.value?.stop(), scrollToMeasure: (measure) => scrollToMeasure(measure) })
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'alphaTab 初始化失败'
  }
}

async function loadScore() {
  await nextTick()
  createApi()
  if (!api.value || !libraryStore.selectedSong) return
  hasRealScore.value = false
  loadError.value = ''
  try {
    let loaded = false
    const song = libraryStore.selectedSong
    if (song && typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window && song.rootPath) {
      const bytes = await invoke<number[]>('read_binary', { path: `${song.rootPath}/${song.score}` })
      loaded = api.value.load(new Uint8Array(bytes))
    } else {
      loaded = api.value.load('/demo/score.musicxml')
    }
    hasRealScore.value = loaded
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '谱面加载失败'
  }
}

function scrollToMeasure(measure: number) {
  scoreStore.currentMeasure = measure
  const target = host.value?.querySelector<HTMLElement>(`[data-bar-index="${measure - 1}"]`)
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  if (!target) host.value?.scrollTo({ top: Math.max(0, (measure - 1) * 42), behavior: 'smooth' })
}

function setLoop() {
  const current = scoreStore.currentMeasure
  scoreStore.setLoop(current, current + 4)
}
function applyPlaybackRange() {
  const range = scoreStore.loop
  const bars = api.value?.score?.masterBars
  if (!api.value || !range || !bars?.length) return
  const first = bars[Math.max(0, range.start - 1)]
  const afterLast = bars[Math.min(bars.length, range.end)]
  if (first) api.value.playbackRange = { startTick: first.start, endTick: afterLast?.start ?? ((bars[bars.length - 1]?.start ?? first.start) + 1920) }
}
function toggleMute() {
  mute.value = !mute.value
  if (api.value?.score) api.value.changeTrackMute(api.value.score.tracks as unknown as alphaTab.model.Track[], mute.value)
}
function toggleSolo() {
  solo.value = !solo.value
  if (api.value?.score) api.value.changeTrackSolo(api.value.score.tracks as unknown as alphaTab.model.Track[], solo.value)
}
function adjustSpeed(delta: number) { scoreStore.changeSpeed(delta); if (api.value) api.value.playbackSpeed = scoreStore.speed / 100 }
function setMeasure(measure: number) { scoreStore.jumpToMeasure(measure) }

watch(() => libraryStore.selectedSong?.id, loadScore)
watch(() => scoreStore.speed, (value) => { if (api.value) api.value.playbackSpeed = value / 100 })
watch(() => scoreStore.loop, applyPlaybackRange, { deep: true })

onMounted(loadScore)
onUnmounted(() => { api.value?.destroy(); api.value = null })
</script>

<template>
  <div class="score-view">
    <div class="score-toolbar">
      <div><h2>{{ title }}</h2><p>{{ libraryStore.selectedSong?.tuning || 'Standard' }} · Capo {{ libraryStore.selectedSong?.capo || 0 }} · alphaTab</p></div>
      <div class="score-controls">
        <button @click="adjustSpeed(-5)">−</button><span class="score-speed">{{ scoreStore.speed }}%</span><button @click="adjustSpeed(5)">+</button>
        <button :class="{ active: mute }" @click="toggleMute">{{ mute ? '取消静音' : '静音' }}</button>
        <button :class="{ active: solo }" @click="toggleSolo">{{ solo ? '取消独奏' : '独奏' }}</button>
        <button @click="setLoop">设为 A-B</button>
      </div>
    </div>
    <div class="score-body">
      <div ref="host" class="alpha-tab-host"></div>
      <div class="measure-strip" aria-label="小节进度">
        <button v-for="measure in 32" :key="measure" :class="{ active: scoreStore.currentMeasure === measure, loop: scoreStore.loop && measure >= scoreStore.loop.start && measure <= scoreStore.loop.end }" @click="setMeasure(measure)">{{ measure }}</button>
      </div>
      <div v-if="!hasRealScore" class="score-placeholder">
        <div><strong>{{ loadError ? '示例谱面载入回退' : '谱面视窗已就绪' }}</strong><p>{{ loadError || '当前歌曲会在此渲染。点击笔记中的小节锚点即可跳转。' }}</p></div>
      </div>
      <div class="staff-demo" aria-label="练习谱面预览">
        <div v-for="line in 5" :key="line" class="staff-line"><span v-if="line === 3" class="staff-note"></span><span v-if="line === 2" class="staff-note"></span><span v-if="line === 4" class="staff-note"></span><span v-if="line === 1" class="staff-note"></span><span v-if="line === 5" class="staff-note"></span></div>
      </div>
    </div>
    <div class="score-footer"><span>小节 {{ scoreStore.currentMeasure }} / 32</span><span class="loop-badge" v-if="scoreStore.loop">A-B {{ scoreStore.loop.start }}–{{ scoreStore.loop.end }}</span><span>{{ scoreStore.speed }}% · 空格播放 · [ ] 调速 · R 重置</span></div>
  </div>
</template>

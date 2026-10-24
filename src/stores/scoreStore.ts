import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { LoopRange, Song } from '../types/domain'

export const useScoreStore = defineStore('score', () => {
  const currentSong = ref<Song | null>(null)
  const isPlaying = ref(false)
  const speed = ref(100)
  const currentMeasure = ref(1)
  const loop = ref<LoopRange | null>(null)
  const isReady = ref(false)
  const scoreApi = ref<{ playPause?: () => void; stop?: () => void; scrollToMeasure?: (measure: number) => void } | null>(null)
  const speedLabel = computed(() => `${speed.value}%`)
  function openSong(song: Song) { currentSong.value = song; isPlaying.value = false; speed.value = 100; currentMeasure.value = 1; loop.value = null; isReady.value = false }
  function setApi(api: typeof scoreApi.value) { scoreApi.value = api; isReady.value = true }
  function togglePlayback() { isPlaying.value = !isPlaying.value; scoreApi.value?.playPause?.() }
  function setPlaying(value: boolean) { isPlaying.value = value }
  function changeSpeed(delta: number) { speed.value = Math.min(150, Math.max(50, speed.value + delta)) }
  function setSpeed(value: number) { speed.value = Math.min(150, Math.max(50, value)) }
  function cyclePracticeSpeed() {
    const presets = [70, 80, 100]
    setSpeed(presets[(presets.indexOf(speed.value) + 1) % presets.length] ?? 70)
  }
  function jumpToMeasure(measure: number, end?: number) { currentMeasure.value = measure; loop.value = end ? { start: measure, end } : loop.value; scoreApi.value?.scrollToMeasure?.(measure) }
  function setLoop(start: number, end: number) { loop.value = { start: Math.min(start, end), end: Math.max(start, end) }; currentMeasure.value = loop.value.start }
  function resetLoop() { currentMeasure.value = loop.value?.start || 1; scoreApi.value?.stop?.(); isPlaying.value = false; scoreApi.value?.scrollToMeasure?.(currentMeasure.value) }
  return { currentSong, isPlaying, speed, speedLabel, currentMeasure, loop, isReady, openSong, setApi, togglePlayback, setPlaying, changeSpeed, setSpeed, cyclePracticeSpeed, jumpToMeasure, setLoop, resetLoop }
})

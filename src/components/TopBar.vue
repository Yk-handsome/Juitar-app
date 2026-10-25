<script setup lang="ts">
import { computed } from 'vue'
import { useLibraryStore } from '../stores/libraryStore'
import { useScoreStore } from '../stores/scoreStore'
import { useAppStore } from '../stores/appStore'

const libraryStore = useLibraryStore()
const scoreStore = useScoreStore()
const appStore = useAppStore()
const emit = defineEmits<{ 'toggle-library': [] }>()
const title = computed(() => libraryStore.selectedSong?.title || '选择一首曲目开始练习')
async function openVault() {
  const path = await appStore.chooseVault()
  if (path) await libraryStore.loadVault(path)
  if (libraryStore.songs.length > 0) await libraryStore.selectSong(libraryStore.songs[0])
}
</script>

<template>
  <header class="top-bar">
    <div class="top-title"><div><div class="eyebrow">PRACTICE DESK / 01 · v0.0.5</div><h1>{{ title }}</h1></div></div>
    <div class="top-actions">
      <div class="top-stat"><strong>{{ scoreStore.speed }}%</strong><span>PLAYBACK</span></div>
      <button class="icon-button library-toggle" title="打开曲库" @click="emit('toggle-library')">☰</button>
      <button class="icon-button" title="打开 Vault" @click="openVault">⌂</button>
      <button class="icon-button" title="设置">⚙</button>
      <button class="primary-button" @click="scoreStore.togglePlayback">{{ scoreStore.isPlaying ? '暂停' : '开始练习' }}</button>
    </div>
  </header>
</template>

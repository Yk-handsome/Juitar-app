<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useAppStore } from '../stores/appStore'
import { useLibraryStore } from '../stores/libraryStore'
import { parseMeasureAnchor, renderMarkdownWithAnchors } from '../services/anchorService'
import { saveNote } from '../services/vaultService'
import type { Song } from '../types/domain'
import { useScoreStore } from '../stores/scoreStore'

const appStore = useAppStore()
const libraryStore = useLibraryStore()
const scoreStore = useScoreStore()
const mode = ref<'edit' | 'preview'>(new URLSearchParams(window.location.search).get('showcase') === 'anchor' ? 'preview' : 'edit')
const localContent = ref('')
const saveTimer = ref<number | undefined>(undefined)
const currentSong = ref<Song | null>(null)
const md = new MarkdownIt({ html: true, breaks: true, linkify: true })
const rendered = computed(() => renderMarkdownWithAnchors(md.render(localContent.value)))

async function persistCurrentNote() {
  if (!currentSong.value) return
  libraryStore.notes[currentSong.value.id] = localContent.value
  await saveNote(currentSong.value, localContent.value)
}

watch(() => libraryStore.selectedSong?.id, async (id, previousId) => {
  if (previousId) {
    if (saveTimer.value) window.clearTimeout(saveTimer.value)
    saveTimer.value = undefined
    await persistCurrentNote()
  }
  currentSong.value = libraryStore.selectedSong
  localContent.value = id ? libraryStore.notes[id] || '' : ''
}, { immediate: true })

function scheduleSave() {
  if (saveTimer.value) window.clearTimeout(saveTimer.value)
  appStore.setSaveStatus('正在保存…')
  saveTimer.value = window.setTimeout(async () => { await persistCurrentNote(); await appStore.setSaveStatus('已自动保存'); saveTimer.value = undefined }, appStore.settings.autoSaveDelay)
}
function handleAnchor(event: MouseEvent) {
  const target = event.target as HTMLElement
  const raw = target.closest<HTMLElement>('[data-anchor]')?.dataset.anchor
  if (!raw) return
  const measure = parseMeasureAnchor(raw)
  if (measure) { scoreStore.jumpToMeasure(measure.start, measure.end); return }
  const time = raw.match(/^\[(\d+):(\d{2})\]$/)
  if (time) appStore.setSaveStatus(`已定位到 ${time[1]}:${time[2]}`)
}
async function insertTemplate() {
  if (!localContent.value) localContent.value = '# 新曲目\n\n## 难点攻关\n\n- [m:1] \n\n## 调音与配置\n\n- 吉他：\n- 效果：\n'
  await nextTick(); scheduleSave()
}

onBeforeUnmount(() => {
  if (saveTimer.value) window.clearTimeout(saveTimer.value)
  void persistCurrentNote()
})
</script>

<template>
  <div class="note-editor">
    <div class="note-header"><div><h2>练习笔记</h2><p>Markdown · 点击锚点跳转谱面</p></div><div class="note-mode"><button :class="{ active: mode === 'edit' }" @click="mode = 'edit'">编辑</button><button :class="{ active: mode === 'preview' }" @click="mode = 'preview'">预览</button></div></div>
    <div class="note-body" @click="handleAnchor">
      <textarea v-if="mode === 'edit'" v-model="localContent" class="note-textarea" spellcheck="false" @input="scheduleSave" />
      <div v-else class="markdown-preview" v-html="rendered"></div>
    </div>
    <div class="note-footer"><span>{{ localContent.length }} 字符 · [m:24] 小节锚点</span><button class="ghost-button" @click="insertTemplate">插入练习模板</button></div>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from 'vue'

const props = withDefaults(defineProps<{ ratio?: number }>(), { ratio: 56 })
const emit = defineEmits<{ 'update:ratio': [value: number] }>()
const resizing = ref(false)
function begin(event: MouseEvent) {
  event.preventDefault()
  resizing.value = true
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', end)
}
function move(event: MouseEvent) {
  if (!resizing.value) return
  const box = document.querySelector<HTMLElement>('.workbench')?.getBoundingClientRect()
  if (!box) return
  emit('update:ratio', Math.min(72, Math.max(28, ((event.clientX - box.left) / box.width) * 100)))
}
function end() {
  resizing.value = false
  window.removeEventListener('mousemove', move)
  window.removeEventListener('mouseup', end)
}
onUnmounted(end)
</script>

<template>
  <section class="workbench" :style="{ gridTemplateColumns: `${props.ratio}% 6px minmax(0, 1fr)` }">
    <div class="pane score-pane"><slot name="left"></slot></div>
    <button class="splitter" aria-label="调整分屏宽度" @mousedown="begin"><span></span></button>
    <div class="pane note-pane"><slot name="right"></slot></div>
  </section>
</template>

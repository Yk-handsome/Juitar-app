import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Song } from '../types/domain'
import { createDemoVault as createDemoVaultData, readNote, saveNote, scanSongs } from '../services/vaultService'
import { useScoreStore } from './scoreStore'

export const useLibraryStore = defineStore('library', () => {
  const songs = ref<Song[]>([])
  const selectedSong = ref<Song | null>(null)
  const query = ref('')
  const activeTag = ref('')
  const notes = ref<Record<string, string>>({})
  const tags = computed(() => [...new Set(songs.value.flatMap((song) => song.tags))].sort())
  const filteredSongs = computed(() => {
    const needle = query.value.trim().toLowerCase()
    return songs.value.filter((song) => {
      const matchesQuery = !needle || [song.title, song.artist, ...song.tags].join(' ').toLowerCase().includes(needle)
      const matchesTag = !activeTag.value || song.tags.includes(activeTag.value)
      return matchesQuery && matchesTag
    })
  })
  async function loadVault(vaultPath: string) { songs.value = await scanSongs(vaultPath) }
  async function selectSong(song: Song) {
    selectedSong.value = song
    notes.value[song.id] = await readNote(song)
    const scoreStore = useScoreStore()
    scoreStore.openSong(song)
  }
  async function updateNote(content: string) {
    if (!selectedSong.value) return
    notes.value[selectedSong.value.id] = content
    await saveNote(selectedSong.value, content)
  }
  async function createDemoVault() { songs.value = await createDemoVaultData(); await selectSong(songs.value[0]) }
  return { songs, selectedSong, query, activeTag, notes, tags, filteredSongs, loadVault, selectSong, updateNote, createDemoVault }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DEFAULT_SETTINGS, readSettings, writeSettings } from '../services/vaultService'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

export const useAppStore = defineStore('app', () => {
  const vaultPath = ref('')
  const saveStatus = ref('就绪')
  const settings = ref({ ...DEFAULT_SETTINGS })

  async function initialize() {
    settings.value = await readSettings()
    vaultPath.value = settings.value.vaultPath
  }
  async function setSaveStatus(status: string) { saveStatus.value = status }
  async function persist() { await writeSettings({ ...settings.value, vaultPath: vaultPath.value }); }
  async function chooseVault(): Promise<string | null> {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return null
    const selected = await open({ directory: true, multiple: false, title: '选择 Juitar Vault 文件夹' })
    if (typeof selected !== 'string') return null
    vaultPath.value = await invoke<string>('open_vault', { path: selected })
    settings.value.vaultPath = vaultPath.value
    await persist()
    return vaultPath.value
  }
  return { vaultPath, saveStatus, settings, initialize, setSaveStatus, persist, chooseVault }
})

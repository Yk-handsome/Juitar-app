import { invoke } from '@tauri-apps/api/core'
import type { AppSettings, Song } from '../types/domain'

const demoNotes = `# Hotel California\n\n## 难点攻关\n\n- [m:4-8] 先用 60 BPM 练习分解和弦。\n- [m:12] 换把位时手腕保持放松。\n- [m:24-28] Solo 进入推弦段，逐步增加速度。\n\n## 调音与配置\n\n- 吉他：Stratocaster\n- 调弦：Standard\n- 效果：Clean Boost + Delay\n\n## 今日目标\n\n完成 24–28 小节连续三次无杂音演奏。`

const memory = new Map<string, string>()
function storageGet(key: string): string | null {
  const storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined
  if (storage && typeof storage.getItem === 'function') return storage.getItem(key)
  return memory.get(key) ?? null
}
function storageSet(key: string, value: string): void {
  const storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined
  if (storage && typeof storage.setItem === 'function') storage.setItem(key, value)
  else memory.set(key, value)
}

export const DEFAULT_SETTINGS: AppSettings = { vaultPath: '', theme: 'dark', defaultSplitRatio: 56, autoSave: true, autoSaveDelay: 800 }

const demoSong: Song = { id: 'hotel-california', title: 'Hotel California', artist: 'Eagles', tags: ['rock', 'solo'], tuning: 'Standard', capo: 0, defaultTempo: 90, score: 'score.musicxml', notes: 'notes.md', practiceLog: 'practice-log.md', rootPath: 'Songs/Hotel California', scoreType: 'alphaTab' }

function isTauriRuntime() { return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window }

export async function readSettings(): Promise<AppSettings> {
  const raw = storageGet('juitar:settings')
  if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) as Partial<AppSettings> }
  if (isTauriRuntime()) { try { return await invoke<AppSettings>('read_settings', { vaultPath: '' }) } catch { /* browser fallback */ } }
  return { ...DEFAULT_SETTINGS }
}

export async function writeSettings(settings: AppSettings): Promise<void> {
  if (isTauriRuntime() && settings.vaultPath) { try { await invoke('write_settings', { vaultPath: settings.vaultPath, settings }); return } catch { /* browser fallback */ } }
  storageSet('juitar:settings', JSON.stringify(settings))
}

export async function scanSongs(vaultPath: string): Promise<Song[]> {
  if (isTauriRuntime() && vaultPath) { try { return await invoke<Song[]>('scan_songs', { vaultPath }) } catch { /* browser fallback */ } }
  const raw = storageGet('juitar:songs')
  return raw ? JSON.parse(raw) as Song[] : []
}

export async function saveNote(song: Song, content: string): Promise<void> {
  if (isTauriRuntime()) { try { await invoke('write_file', { path: `${song.rootPath}/${song.notes}`, content }); return } catch { /* browser fallback */ } }
  storageSet(`juitar:note:${song.id}`, content)
}

export async function readNote(song: Song): Promise<string> {
  if (isTauriRuntime()) { try { return await invoke<string>('read_file', { path: `${song.rootPath}/${song.notes}` }) } catch { /* browser fallback */ } }
  return storageGet(`juitar:note:${song.id}`) || demoNotes
}

export async function createDemoVault(): Promise<Song[]> {
  if (isTauriRuntime()) {
    try {
      const vaultPath = await invoke<string>('create_demo_vault')
      return await scanSongs(vaultPath)
    } catch {
      // Fall through to the browser-safe local demo.
    }
  }
  storageSet('juitar:songs', JSON.stringify([demoSong]))
  storageSet(`juitar:note:${demoSong.id}`, demoNotes)
  return [demoSong]
}

export function getDemoSong() { return demoSong }

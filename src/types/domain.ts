export interface Song {
  id: string
  title: string
  artist: string
  tags: string[]
  tuning: string
  capo: number
  defaultTempo: number
  score: string
  notes: string
  practiceLog?: string
  audio?: string
  rootPath: string
  scoreType: 'alphaTab' | 'pdf' | 'unknown'
}

export interface AppSettings {
  vaultPath: string
  theme: 'dark' | 'light'
  defaultSplitRatio: number
  autoSave: boolean
  autoSaveDelay: number
  lastSongId?: string
  lastPosition?: number
}

export type Anchor =
  | { type: 'measure'; start: number; end?: number; raw: string; startIndex: number; endIndex: number }
  | { type: 'timestamp'; seconds: number; raw: string; startIndex: number; endIndex: number }
  | { type: 'chord'; name: string; raw: string; startIndex: number; endIndex: number }

export interface LoopRange { start: number; end: number }

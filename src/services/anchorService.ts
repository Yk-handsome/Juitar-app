import type { Anchor } from '../types/domain'

const MEASURE = /\[m:(\d+)(?:-(\d+))?\]/g
const TIME = /\[(\d{1,2}):(\d{2})\]/g
const CHORD = /\[chord:([^\]]+)\]/g

export function parseAnchors(source: string): Anchor[] {
  const anchors: Anchor[] = []
  for (const match of source.matchAll(MEASURE)) {
    anchors.push({ type: 'measure', start: Number(match[1]), end: match[2] ? Number(match[2]) : undefined, raw: match[0], startIndex: match.index ?? 0, endIndex: (match.index ?? 0) + match[0].length })
  }
  for (const match of source.matchAll(TIME)) {
    const minutes = Number(match[1]); const seconds = Number(match[2])
    anchors.push({ type: 'timestamp', seconds: minutes * 60 + seconds, raw: match[0], startIndex: match.index ?? 0, endIndex: (match.index ?? 0) + match[0].length })
  }
  for (const match of source.matchAll(CHORD)) {
    anchors.push({ type: 'chord', name: match[1].trim(), raw: match[0], startIndex: match.index ?? 0, endIndex: (match.index ?? 0) + match[0].length })
  }
  return anchors.sort((a, b) => a.startIndex - b.startIndex)
}

export function renderMarkdownWithAnchors(source: string): string {
  return source
    .replace(MEASURE, (raw, start: string, end?: string) => `<button class="anchor-pill" data-anchor="${raw}">${end ? `小节 ${start}–${end}` : `小节 ${start}`}</button>`)
    .replace(TIME, (raw) => `<button class="anchor-pill" data-anchor="${raw}">${raw.slice(1, -1)}</button>`)
    .replace(CHORD, (raw, name: string) => `<button class="anchor-pill" data-anchor="${raw}">和弦 ${name}</button>`)
}

export function parseMeasureAnchor(raw: string): { start: number; end?: number } | null {
  const match = raw.match(/^\[m:(\d+)(?:-(\d+))?\]$/)
  return match ? { start: Number(match[1]), end: match[2] ? Number(match[2]) : undefined } : null
}

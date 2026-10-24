import { describe, expect, it } from 'vitest'
import { parseAnchors, parseMeasureAnchor, renderMarkdownWithAnchors } from './anchorService'

describe('AnchorParser', () => {
  it('parses a single measure anchor', () => {
    const anchors = parseAnchors('练习 [m:24]')
    expect(anchors).toHaveLength(1)
    expect(anchors[0]).toMatchObject({ type: 'measure', start: 24, raw: '[m:24]' })
  })
  it('parses a measure range', () => {
    expect(parseMeasureAnchor('[m:24-28]')).toEqual({ start: 24, end: 28 })
  })
  it('parses timestamp and chord anchors in source order', () => {
    const anchors = parseAnchors('[chord:Bm7] then [01:42]')
    expect(anchors.map((anchor) => anchor.type)).toEqual(['chord', 'timestamp'])
  })
  it('renders clickable anchor pills', () => {
    const rendered = renderMarkdownWithAnchors('- [m:24-28] solo')
    expect(rendered).toContain('data-anchor="[m:24-28]"')
    expect(rendered).toContain('小节 24–28')
  })
})

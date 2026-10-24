import { describe, expect, it } from 'vitest'
import { createDemoVault, readNote, scanSongs } from './vaultService'

describe('Vault service', () => {
  it('creates and scans a demo song', async () => {
    const created = await createDemoVault()
    const scanned = await scanSongs('')
    expect(created).toHaveLength(1)
    expect(scanned[0]).toMatchObject({ title: 'Hotel California', score: 'score.musicxml' })
  })
  it('returns markdown notes for the demo song', async () => {
    const songs = await createDemoVault()
    const note = await readNote(songs[0])
    expect(note).toContain('[m:24-28]')
  })
})

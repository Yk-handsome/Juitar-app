import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useScoreStore } from './scoreStore'

describe('score practice presets', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('cycles through 70, 80 and 100 percent presets', () => {
    const store = useScoreStore()
    store.setSpeed(70)
    store.cyclePracticeSpeed()
    expect(store.speed).toBe(80)
    store.cyclePracticeSpeed()
    expect(store.speed).toBe(100)
    store.cyclePracticeSpeed()
    expect(store.speed).toBe(70)
  })

  it('keeps loop endpoints ordered when an anchor is selected', () => {
    const store = useScoreStore()
    store.setLoop(12, 8)
    expect(store.loop).toEqual({ start: 8, end: 12 })
    expect(store.currentMeasure).toBe(8)
  })
})

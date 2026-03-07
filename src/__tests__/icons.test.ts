import { describe, it, expect } from 'vitest'
import { getIcon } from '@/lib/icons'

describe('getIcon', () => {
  it('returns correct emoji for known tokens', () => {
    expect(getIcon('calendar')).toBe('📅')
    expect(getIcon('crown')).toBe('👑')
    expect(getIcon('globe')).toBe('🌍')
    expect(getIcon('plane')).toBe('✈️')
    expect(getIcon('rocket')).toBe('🚀')
    expect(getIcon('compass')).toBe('🧭')
    expect(getIcon('briefcase')).toBe('💼')
  })

  it('returns default plane emoji for unknown tokens', () => {
    expect(getIcon('unknown')).toBe('✈️')
    expect(getIcon('')).toBe('✈️')
    expect(getIcon('nonexistent')).toBe('✈️')
  })
})

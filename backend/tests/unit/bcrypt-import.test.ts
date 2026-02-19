import { describe, it, expect } from 'vitest'
import bcryptjs from 'bcryptjs'

describe('bcryptjs availability', () => {
  it('should import bcryptjs and expose hash/compare', async () => {
    expect(typeof bcryptjs.hash).toBe('function')
    expect(typeof bcryptjs.compare).toBe('function')
    const hash = await bcryptjs.hash('test-password', 4)
    const ok = await bcryptjs.compare('test-password', hash)
    expect(ok).toBe(true)
  })
})

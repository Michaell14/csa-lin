import { afterEach, expect, it, vi } from 'vitest'
import { memoriesEnabled } from './flags'

afterEach(() => vi.unstubAllEnvs())
it('shows memories unless the deployment turns them off', () => {
  vi.stubEnv('NEXT_PUBLIC_MEMORIES_ENABLED', '')
  expect(memoriesEnabled()).toBe(true)
  vi.stubEnv('NEXT_PUBLIC_MEMORIES_ENABLED', 'true')
  expect(memoriesEnabled()).toBe(true)
  vi.stubEnv('NEXT_PUBLIC_MEMORIES_ENABLED', 'false')
  expect(memoriesEnabled()).toBe(false)
})

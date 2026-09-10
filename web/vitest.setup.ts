import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Testing Library's auto-cleanup only self-registers when `afterEach` is a
// global (i.e. `test.globals: true`), which this project doesn't set.
// Without this, multiple `render()` calls in one test file pile up in the
// jsdom document instead of unmounting between tests.
afterEach(() => cleanup())

// jsdom lacks these; React Flow and some layout code expect them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub
if (!globalThis.DOMMatrixReadOnly) {
  // @ts-expect-error minimal stub
  globalThis.DOMMatrixReadOnly = class { m22 = 1; constructor() {} }
}

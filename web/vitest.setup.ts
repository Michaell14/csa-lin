import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Some desktop Node runtimes expose an incomplete built-in localStorage when
// no backing file is configured. Give jsdom tests the browser Storage contract.
if (typeof window.localStorage?.getItem !== 'function') {
  const values = new Map<string, string>()
  const storage: Storage = {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key) },
    setItem: (key, value) => { values.set(key, String(value)) },
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
}

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
